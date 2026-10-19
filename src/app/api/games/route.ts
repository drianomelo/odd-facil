import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { games, teams, odds } from '@/lib/db/schema';
import { eq, and, gte, lt, desc, sql } from 'drizzle-orm';
import { fromAppTimeZone, getPlayerPropAnalysisWindow, isGameStarted } from '@/lib/utils/date';
import { alias } from 'drizzle-orm/pg-core';
import { Game, MarketOdds, SelectionType } from '@/types';
import { marginFreeProbabilities } from '@/lib/utils/math';
import { oddsApiClient } from '@/lib/api/odds-api';

const homeTeam = alias(teams, 'home_team');
const awayTeam = alias(teams, 'away_team');

function gameIdentity(game: {
  commence_time: Date | string;
  home_team: { name: string };
  away_team: { name: string };
}) {
  return [
    new Date(game.commence_time).getTime(),
    game.home_team.name.trim().toLowerCase(),
    game.away_team.name.trim().toLowerCase(),
  ].join(':');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const status = searchParams.get('status');

  const defaultWindow = getPlayerPropAnalysisWindow();
  const startText = from || date;
  const endText = to || date;
  const rangeStart = startText
    ? startText.includes('T') ? new Date(startText) : fromAppTimeZone(new Date(`${startText}T00:00:00`))
    : defaultWindow.from;
  const rangeEnd = endText
    ? endText.includes('T')
      ? new Date(endText)
      : (() => {
          const dayAfterEnd = new Date(`${endText}T00:00:00Z`);
          dayAfterEnd.setUTCDate(dayAfterEnd.getUTCDate() + 1);
          return fromAppTimeZone(new Date(`${dayAfterEnd.toISOString().slice(0, 10)}T00:00:00`));
        })()
    : defaultWindow.to;

  let liveSchedule: Game[] = [];
  try {
    liveSchedule = await oddsApiClient.getNbaSchedule(rangeStart, rangeEnd);
  } catch (error) {
    console.error('[API/games] Live schedule unavailable:', error);
  }

  try {
    const results = await db
      .select({
        game: games,
        homeTeam: homeTeam,
        awayTeam: awayTeam,
      })
      .from(games)
      .innerJoin(homeTeam, eq(games.home_team_id, homeTeam.id))
      .innerJoin(awayTeam, eq(games.away_team_id, awayTeam.id))
      .where(and(
        gte(games.commence_time, rangeStart),
        lt(games.commence_time, rangeEnd),
        status ? eq(games.status, status) : sql`1=1`
      ))
      .orderBy(games.commence_time);

    if (results.length === 0) {
      return NextResponse.json({
        games: liveSchedule.map(game => ({ ...game, started: isGameStarted(game.commence_time) })),
        message: liveSchedule.length ? undefined : 'A fonte ainda não retornou jogos para este período.',
      });
    }

    const gamesWithOdds = await Promise.all(results.map(async (r) => {
      const gameOdds = await db
        .select()
        .from(odds)
        .where(eq(odds.game_id, r.game.id))
        .orderBy(desc(odds.collected_at));

      const marketBuckets = new Map<string, MarketOdds>();
      const quotesByBook = new Map<string, Record<string, number>>();
      const latestQuoteKeys = new Set<string>();

      for (const row of gameOdds) {
        const selection = row.selection as SelectionType;
        const storedLine = row.line == null ? undefined : Number(row.line);
        const marketLine = row.market === 'spreads' && selection === 'away_spread' && storedLine !== undefined
          ? -storedLine
          : storedLine;
        const lineKey = marketLine === undefined ? 'main' : String(marketLine);
        const marketKey = `${row.market}:${lineKey}`;
        const latestQuoteKey = `${marketKey}:${row.bookmaker_key}:${selection}`;
        if (latestQuoteKeys.has(latestQuoteKey)) continue;
        latestQuoteKeys.add(latestQuoteKey);
        let market = marketBuckets.get(marketKey);

        if (!market) {
          market = {
            market: row.market as MarketOdds['market'],
            line: marketLine,
            selections: { home: [], away: [], over: [], under: [], home_spread: [], away_spread: [] },
            best_odds: {} as MarketOdds['best_odds'],
            fair_probabilities: {},
          };
          marketBuckets.set(marketKey, market);
        }

        const odd = {
          bookmaker: row.bookmaker_title,
          bookmaker_key: row.bookmaker_key,
          market: row.market as MarketOdds['market'],
          line: storedLine,
          selection,
          odds: Number(row.odds),
          collected_at: row.collected_at.toISOString(),
          freshness: 'current' as const,
        };
        market.selections[selection].push(odd);
        if (!market.best_odds[selection] || odd.odds > market.best_odds[selection].odds) {
          market.best_odds[selection] = odd;
        }

        const quoteKey = `${marketKey}:${row.bookmaker_key}`;
        const bookQuotes = quotesByBook.get(quoteKey) || {};
        if (bookQuotes[selection] === undefined) bookQuotes[selection] = odd.odds;
        quotesByBook.set(quoteKey, bookQuotes);
      }

      const probabilitySums = new Map<string, Partial<Record<SelectionType, number>>>();
      const probabilityCounts = new Map<string, Partial<Record<SelectionType, number>>>();
      for (const [quoteKey, bookQuotes] of Array.from(quotesByBook.entries())) {
        if (Object.keys(bookQuotes).length < 2) continue;
        const probabilities = marginFreeProbabilities(bookQuotes);
        const marketKey = quoteKey.slice(0, quoteKey.lastIndexOf(':'));
        const sums = probabilitySums.get(marketKey) || {};
        const counts = probabilityCounts.get(marketKey) || {};
        for (const [selection, probability] of Object.entries(probabilities)) {
          const key = selection as SelectionType;
          sums[key] = (sums[key] || 0) + probability;
          counts[key] = (counts[key] || 0) + 1;
        }
        probabilitySums.set(marketKey, sums);
        probabilityCounts.set(marketKey, counts);
      }

      for (const [marketKey, market] of Array.from(marketBuckets.entries())) {
        const sums = probabilitySums.get(marketKey) || {};
        const counts = probabilityCounts.get(marketKey) || {};
        for (const selection of Object.keys(sums) as SelectionType[]) {
          const count = counts[selection] || 0;
          if (count) market.fair_probabilities![selection] = (sums[selection] || 0) / count;
        }
      }

      const markets = Array.from(marketBuckets.values());

      return {
        id: r.game.id,
        commence_time: r.game.commence_time,
        updated_at: r.game.updated_at.toISOString(),
        status: r.game.status,
        home_score: r.game.home_score,
        away_score: r.game.away_score,
        home_team: { id: r.homeTeam.id, name: r.homeTeam.name, abbreviation: r.homeTeam.abbreviation },
        away_team: { id: r.awayTeam.id, name: r.awayTeam.name, abbreviation: r.awayTeam.abbreviation },
        markets: Object.values(markets),
        started: isGameStarted(r.game.commence_time.toISOString()),
      };
    }));

    const knownGames = new Set(gamesWithOdds.map(gameIdentity));
    const missingGames = liveSchedule
      .filter(game => !knownGames.has(gameIdentity(game)))
      .map(game => ({ ...game, started: isGameStarted(game.commence_time) }));
    const allGames = [...gamesWithOdds, ...missingGames]
      .sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
    return NextResponse.json({
      games: allGames,
      message: allGames.length ? undefined : 'A fonte ainda não retornou jogos para este período.',
    });
  } catch (error) {
    console.error('[API/games] Error:', error);
    if (liveSchedule.length) {
      return NextResponse.json({
        games: liveSchedule.map(game => ({ ...game, started: isGameStarted(game.commence_time) })),
        message: 'Agenda carregada da fonte ao vivo; o banco de dados está temporariamente indisponível.',
      });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error', stack: error instanceof Error ? error.stack : undefined }, { status: 500 });
  }
}
