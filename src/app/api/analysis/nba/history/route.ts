import { NextRequest, NextResponse } from 'next/server';
import { and, count, desc, eq, gte, isNotNull, lte, SQL, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { playerPropForecasts } from '@/lib/db/schema';
import { PlayerPropMarket } from '@/lib/analysis/player-props';
import { getCurrentPlayerPropMarkets } from '@/lib/api/propline';
import { PLAYER_PROP_MODEL_VERSION } from '@/lib/analysis/player-prop-storage';
import { getNbaSeasonPhase, NBA_REGULAR_SEASON_START } from '@/lib/analysis/nba-season';
import { fromAppTimeZone } from '@/lib/utils/date';
import { NBA_PREDICTIONS_ENABLED } from '@/lib/analysis/prediction-controls';

export const dynamic = 'force-dynamic';

const MARKETS: PlayerPropMarket[] = [
  'player_points',
  'player_rebounds',
  'player_assists',
  'player_threes',
  'player_points_rebounds_assists',
];
const RESULTS = ['pending', 'won', 'lost', 'push', 'void'] as const;
type HistoryResultFilter = typeof RESULTS[number];

function parseDateBoundary(value: string | null, endOfDay = false): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = fromAppTimeZone(new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function gameFromDetails(details: unknown): string | null {
  let value = details;
  if (typeof details === 'string') {
    try { value = JSON.parse(details); } catch { return null; }
  }
  if (!value || typeof value !== 'object') return null;
  const game = (value as Record<string, unknown>).game;
  return typeof game === 'string' && game.trim() ? game : null;
}

function normalizedBook(value: string | null): string {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const rawResult = params.get('result') || 'all';
    const market = params.get('market');
    const team = params.get('team');
    const player = params.get('player');
    const rawPhase = 'regular';
    const regularSeasonFilter = sql`(${playerPropForecasts.commence_time} at time zone 'America/New_York')::date >= ${NBA_REGULAR_SEASON_START}::date`;
    const from = parseDateBoundary(params.get('from'));
    const through = parseDateBoundary(params.get('to'), true);
    const limit = Math.min(100, Math.max(1, Number.parseInt(params.get('limit') || '30', 10) || 30));
    const offset = Math.max(0, Number.parseInt(params.get('offset') || '0', 10) || 0);

    if (rawResult !== 'all' && !RESULTS.includes(rawResult as HistoryResultFilter)) {
      return NextResponse.json({ error: 'Filtro de resultado inválido.' }, { status: 400 });
    }
    if (market && !MARKETS.includes(market as PlayerPropMarket)) {
      return NextResponse.json({ error: 'Filtro de mercado inválido.' }, { status: 400 });
    }
    if (params.has('from') && !from) return NextResponse.json({ error: 'Data inicial inválida.' }, { status: 400 });
    if (params.has('to') && !through) return NextResponse.json({ error: 'Data final inválida.' }, { status: 400 });
    if (from && through && from > through) {
      return NextResponse.json({ error: 'O período informado está invertido.' }, { status: 400 });
    }

    const filters: SQL[] = [eq(playerPropForecasts.model_version, PLAYER_PROP_MODEL_VERSION)];
    if (!NBA_PREDICTIONS_ENABLED) filters.push(lte(playerPropForecasts.commence_time, new Date()));
    if (market) filters.push(eq(playerPropForecasts.market, market as PlayerPropMarket));
    if (team) filters.push(eq(playerPropForecasts.player_team, team));
    if (player) filters.push(eq(playerPropForecasts.player_name, player));
    if (from) filters.push(gte(playerPropForecasts.commence_time, from));
    if (through) filters.push(lte(playerPropForecasts.commence_time, through));
    filters.push(regularSeasonFilter);
    const where = and(...filters);
    const uniqueForecasts = db.selectDistinctOn(
      [playerPropForecasts.event_id, playerPropForecasts.player_name, playerPropForecasts.market],
      {
        id: playerPropForecasts.id,
        eventId: playerPropForecasts.event_id,
        player: playerPropForecasts.player_name,
        playerTeam: playerPropForecasts.player_team,
        market: playerPropForecasts.market,
        line: playerPropForecasts.line,
        selection: playerPropForecasts.selection,
        projection: playerPropForecasts.projection,
        predictedProbability: playerPropForecasts.predicted_probability,
        expectedValue: playerPropForecasts.expected_value,
        shortlistEligible: playerPropForecasts.shortlist_eligible,
        americanOdds: playerPropForecasts.american_odds,
        bookmaker: playerPropForecasts.bookmaker,
        confidence: playerPropForecasts.confidence,
        sampleSize: playerPropForecasts.sample_size,
        commenceTime: playerPropForecasts.commence_time,
        recordedAt: playerPropForecasts.recorded_at,
        actualValue: playerPropForecasts.actual_value,
        result: playerPropForecasts.result,
        gradedAt: playerPropForecasts.graded_at,
        details: playerPropForecasts.details,
      },
    ).from(playerPropForecasts).where(where).orderBy(
      playerPropForecasts.event_id,
      playerPropForecasts.player_name,
      playerPropForecasts.market,
      desc(playerPropForecasts.shortlist_eligible),
      sql`${playerPropForecasts.expected_value} desc nulls last`,
      desc(playerPropForecasts.predicted_probability),
      desc(playerPropForecasts.sample_size),
      playerPropForecasts.recorded_at,
    ).as('unique_player_prop_forecasts');
    const resultFilters: SQL[] = [];
    if (rawResult === 'pending') resultFilters.push(sql`${uniqueForecasts.result} is null`);
    else if (rawResult !== 'all') resultFilters.push(eq(uniqueForecasts.result, rawResult as HistoryResultFilter));
    const uniqueWhere = resultFilters.length ? and(...resultFilters) : undefined;

    const [rows, [filteredCount], [summary], playerTeamFacets] = await Promise.all([
      db.select({
        id: uniqueForecasts.id,
        eventId: uniqueForecasts.eventId,
        player: uniqueForecasts.player,
        playerTeam: uniqueForecasts.playerTeam,
        market: uniqueForecasts.market,
        line: uniqueForecasts.line,
        selection: uniqueForecasts.selection,
        projection: uniqueForecasts.projection,
        predictedProbability: uniqueForecasts.predictedProbability,
        americanOdds: uniqueForecasts.americanOdds,
        bookmaker: uniqueForecasts.bookmaker,
        confidence: uniqueForecasts.confidence,
        sampleSize: uniqueForecasts.sampleSize,
        commenceTime: uniqueForecasts.commenceTime,
        recordedAt: uniqueForecasts.recordedAt,
        actualValue: uniqueForecasts.actualValue,
        result: uniqueForecasts.result,
        gradedAt: uniqueForecasts.gradedAt,
        details: uniqueForecasts.details,
      }).from(uniqueForecasts).where(uniqueWhere)
        .orderBy(desc(uniqueForecasts.commenceTime), desc(uniqueForecasts.recordedAt))
        .limit(limit).offset(offset),
      db.select({ total: count() }).from(uniqueForecasts).where(uniqueWhere),
      db.select({
        total: count(),
        pending: sql<number>`count(*) filter (where ${uniqueForecasts.result} is null)`,
        won: sql<number>`count(*) filter (where ${uniqueForecasts.result} = 'won')`,
        lost: sql<number>`count(*) filter (where ${uniqueForecasts.result} = 'lost')`,
        push: sql<number>`count(*) filter (where ${uniqueForecasts.result} = 'push')`,
        void: sql<number>`count(*) filter (where ${uniqueForecasts.result} = 'void')`,
        preseason: sql<number>`count(*) filter (where (${uniqueForecasts.commenceTime} at time zone 'America/New_York')::date < ${NBA_REGULAR_SEASON_START}::date)`,
        regular: sql<number>`count(*) filter (where (${uniqueForecasts.commenceTime} at time zone 'America/New_York')::date >= ${NBA_REGULAR_SEASON_START}::date)`,
      }).from(uniqueForecasts).where(uniqueWhere),
      db.selectDistinct({ team: playerPropForecasts.player_team, player: playerPropForecasts.player_name })
        .from(playerPropForecasts)
        .where(and(eq(playerPropForecasts.model_version, PLAYER_PROP_MODEL_VERSION), isNotNull(playerPropForecasts.player_team))),
    ]);

    let currentMarkets: Awaited<ReturnType<typeof getCurrentPlayerPropMarkets>> = [];
    if (NBA_PREDICTIONS_ENABLED && process.env.PROPLINE_API_KEY && rows.some(row => new Date(row.commenceTime).getTime() > Date.now())) {
      try { currentMarkets = await getCurrentPlayerPropMarkets(); } catch (error) {
        console.warn('[API/analysis/nba/history] Could not load current prop prices:', error);
      }
    }

    return NextResponse.json({
      modelVersion: PLAYER_PROP_MODEL_VERSION,
      filters: { result: rawResult, market: market || 'all', phase: rawPhase, team: team || 'all', player: player || 'all', from: params.get('from'), to: params.get('to') },
      playerTeamFacets: playerTeamFacets.filter(item => item.team),
      page: { limit, offset, total: Number(filteredCount?.total || 0) },
      summary: Object.fromEntries(Object.entries(summary || {}).map(([key, value]) => [key, Number(value || 0)])),
      forecasts: rows.map(row => ({
        ...row,
        line: Number(row.line),
        projection: Number(row.projection),
        predictedProbability: Number(row.predictedProbability),
        actualValue: row.actualValue === null ? null : Number(row.actualValue),
        result: row.result || 'pending',
        game: gameFromDetails(row.details),
        seasonPhase: getNbaSeasonPhase(row.commenceTime as Date),
        marketMovement: (() => {
          if (new Date(row.commenceTime).getTime() <= Date.now()) return { status: 'closed' as const };
          const options = currentMarkets.filter(candidate => candidate.eventId === row.eventId
            && candidate.player.toLowerCase() === row.player.toLowerCase()
            && candidate.market === row.market);
          const side = row.selection as 'Over' | 'Under';
          const savedBook = normalizedBook(row.bookmaker);
          const matchingBook = options.flatMap(candidate => candidate.quotes
            .filter(quote => quote.side === side && savedBook && normalizedBook(quote.bookmaker) === savedBook)
            .map(quote => ({ candidate, quote })))
            .sort((a, b) => Math.abs(a.candidate.line - Number(row.line)) - Math.abs(b.candidate.line - Number(row.line)))[0];
          if (matchingBook) return {
            status: 'available' as const,
            sameBookmaker: true,
            currentLine: matchingBook.candidate.line,
            currentAmericanOdds: matchingBook.quote.price,
            currentBookmaker: matchingBook.quote.bookmaker,
            lineChanged: matchingBook.candidate.line !== Number(row.line),
            oddsChanged: row.americanOdds !== null && matchingBook.quote.price !== row.americanOdds,
          };
          const best = options.flatMap(candidate => candidate.quotes
            .filter(quote => quote.side === side)
            .map(quote => ({ candidate, quote })))
            .sort((a, b) => b.quote.price - a.quote.price)[0];
          if (best) return {
            status: 'available' as const,
            sameBookmaker: false,
            currentLine: best.candidate.line,
            currentAmericanOdds: best.quote.price,
            currentBookmaker: best.quote.bookmaker,
            lineChanged: best.candidate.line !== Number(row.line),
            oddsChanged: null,
          };
          return { status: process.env.PROPLINE_API_KEY ? 'unavailable' as const : 'unconfigured' as const };
        })(),
      })),
    });
  } catch (error) {
    console.error('[API/analysis/nba/history] Failed:', error);
    return NextResponse.json({ error: 'Não foi possível carregar o histórico de previsões.' }, { status: 500 });
  }
}

