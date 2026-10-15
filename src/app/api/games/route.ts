import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { games, teams, odds } from '@/lib/db/schema';
import { eq, and, gte, lt, desc, sql } from 'drizzle-orm';
import { fromAppTimeZone, isGameStarted } from '@/lib/utils/date';
import { alias } from 'drizzle-orm/pg-core';
import { MarketOdds, SelectionType } from '@/types';
import { marginFreeProbabilities } from '@/lib/utils/math';

const homeTeam = alias(teams, 'home_team');
const awayTeam = alias(teams, 'away_team');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const from = searchParams.get('from') || date;
  const to = searchParams.get('to') || date;
  const status = searchParams.get('status');

  const startOfRange = fromAppTimeZone(new Date(`${from}T00:00:00`));
  const dayAfterEnd = new Date(`${to}T00:00:00Z`);
  dayAfterEnd.setUTCDate(dayAfterEnd.getUTCDate() + 1);
  const endOfRange = fromAppTimeZone(new Date(`${dayAfterEnd.toISOString().slice(0, 10)}T00:00:00`));

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
        gte(games.commence_time, startOfRange),
        lt(games.commence_time, endOfRange),
        status ? eq(games.status, status) : sql`1=1`
      ))
      .orderBy(games.commence_time);

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

    return NextResponse.json({ games: gamesWithOdds });
  } catch (error) {
    console.error('[API/games] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error', stack: error instanceof Error ? error.stack : undefined }, { status: 500 });
  }
}
