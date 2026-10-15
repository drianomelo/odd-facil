import { NextResponse } from 'next/server';
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { playerPropForecasts } from '@/lib/db/schema';
import { PlayerPropMarket } from '@/lib/analysis/player-props';
import { PLAYER_PROP_MODEL_VERSION } from '@/lib/analysis/player-prop-storage';
import { NBA_REGULAR_SEASON_START } from '@/lib/analysis/nba-season';

export const dynamic = 'force-dynamic';

function gameFromDetails(details: unknown): string | null {
  let value = details;
  if (typeof details === 'string') {
    try { value = JSON.parse(details); } catch { return null; }
  }
  if (!value || typeof value !== 'object') return null;
  const game = (value as Record<string, unknown>).game;
  return typeof game === 'string' && game.trim() ? game : null;
}

export async function GET() {
  try {
    const regularSeasonOnly = sql`(${playerPropForecasts.commence_time} at time zone 'America/New_York')::date >= ${NBA_REGULAR_SEASON_START}::date`;
    const [[row], recentRows] = await Promise.all([db.select({
      total: count(),
      pending: sql<number>`count(*) filter (where ${playerPropForecasts.result} is null)`,
      settled: sql<number>`count(*) filter (where ${playerPropForecasts.result} in ('won', 'lost', 'push', 'void'))`,
      wins: sql<number>`count(*) filter (where ${playerPropForecasts.result} = 'won')`,
      losses: sql<number>`count(*) filter (where ${playerPropForecasts.result} = 'lost')`,
      pushes: sql<number>`count(*) filter (where ${playerPropForecasts.result} = 'push')`,
      voids: sql<number>`count(*) filter (where ${playerPropForecasts.result} = 'void')`,
      gradedBets: sql<number>`count(*) filter (where ${playerPropForecasts.result} in ('won', 'lost'))`,
      betsWithOdds: sql<number>`count(*) filter (where ${playerPropForecasts.result} in ('won', 'lost') and ${playerPropForecasts.american_odds} is not null)`,
      brierScore: sql<number>`avg(power(${playerPropForecasts.predicted_probability} - case when ${playerPropForecasts.result} = 'won' then 1 else 0 end, 2)) filter (where ${playerPropForecasts.result} in ('won', 'lost'))`,
      netUnits: sql<number>`coalesce(sum(case
        when ${playerPropForecasts.result} = 'won' and ${playerPropForecasts.american_odds} > 0 then ${playerPropForecasts.american_odds}::numeric / 100
        when ${playerPropForecasts.result} = 'won' and ${playerPropForecasts.american_odds} < 0 then 100::numeric / abs(${playerPropForecasts.american_odds})
        when ${playerPropForecasts.result} = 'lost' and ${playerPropForecasts.american_odds} is not null then -1
        else 0 end), 0)`,
    }).from(playerPropForecasts).where(and(
      eq(playerPropForecasts.model_version, PLAYER_PROP_MODEL_VERSION),
      regularSeasonOnly,
    )), db.select({
      id: playerPropForecasts.id,
      eventId: playerPropForecasts.event_id,
      player: playerPropForecasts.player_name,
      market: playerPropForecasts.market,
      line: playerPropForecasts.line,
      selection: playerPropForecasts.selection,
      projection: playerPropForecasts.projection,
      predictedProbability: playerPropForecasts.predicted_probability,
      americanOdds: playerPropForecasts.american_odds,
      bookmaker: playerPropForecasts.bookmaker,
      actualValue: playerPropForecasts.actual_value,
      result: playerPropForecasts.result,
      commenceTime: playerPropForecasts.commence_time,
      gradedAt: playerPropForecasts.graded_at,
      details: playerPropForecasts.details,
    }).from(playerPropForecasts).where(and(
      eq(playerPropForecasts.model_version, PLAYER_PROP_MODEL_VERSION),
      regularSeasonOnly,
      inArray(playerPropForecasts.result, ['won', 'lost', 'push', 'void']),
    )).orderBy(desc(playerPropForecasts.graded_at), desc(playerPropForecasts.commence_time)).limit(50)]);

    const marketRows = await db.select({
      market: playerPropForecasts.market,
      total: count(),
      pending: sql<number>`count(*) filter (where ${playerPropForecasts.result} is null)`,
      settled: sql<number>`count(*) filter (where ${playerPropForecasts.result} in ('won', 'lost', 'push', 'void'))`,
      wins: sql<number>`count(*) filter (where ${playerPropForecasts.result} = 'won')`,
      losses: sql<number>`count(*) filter (where ${playerPropForecasts.result} = 'lost')`,
      pushes: sql<number>`count(*) filter (where ${playerPropForecasts.result} = 'push')`,
      meanAbsoluteError: sql<number>`avg(abs(${playerPropForecasts.actual_value} - ${playerPropForecasts.projection})) filter (where ${playerPropForecasts.actual_value} is not null)`,
      brierScore: sql<number>`avg(power(${playerPropForecasts.predicted_probability} - case when ${playerPropForecasts.result} = 'won' then 1 else 0 end, 2)) filter (where ${playerPropForecasts.result} in ('won', 'lost'))`,
    }).from(playerPropForecasts)
      .where(and(
        eq(playerPropForecasts.model_version, PLAYER_PROP_MODEL_VERSION),
        regularSeasonOnly,
      ))
      .groupBy(playerPropForecasts.market);

    const settled = Number(row?.settled || 0);
    const decisive = Number(row?.wins || 0) + Number(row?.losses || 0);
    const betsWithOdds = Number(row?.betsWithOdds || 0);
    const netUnits = Number(row?.netUnits || 0);
    return NextResponse.json({
      totalForecasts: Number(row?.total || 0),
      modelVersion: PLAYER_PROP_MODEL_VERSION,
      seasonPhase: 'regular',
      pending: Number(row?.pending || 0),
      settled,
      wins: Number(row?.wins || 0),
      losses: Number(row?.losses || 0),
      pushes: Number(row?.pushes || 0),
      voids: Number(row?.voids || 0),
      hitRate: decisive ? Number(row?.wins || 0) / decisive : null,
      brierScore: row?.brierScore === null ? null : Number(row?.brierScore),
      betsWithOdds,
      netUnits: Number(netUnits.toFixed(3)),
      roiPercent: betsWithOdds ? Number(((netUnits / betsWithOdds) * 100).toFixed(2)) : null,
      recentSettled: recentRows.map(forecast => ({
        ...forecast,
        line: Number(forecast.line),
        projection: Number(forecast.projection),
        predictedProbability: Number(forecast.predictedProbability),
        actualValue: forecast.actualValue === null ? null : Number(forecast.actualValue),
        game: gameFromDetails(forecast.details),
      })),
      byMarket: marketRows.map(marketRow => {
        const marketDecisive = Number(marketRow.wins || 0) + Number(marketRow.losses || 0);
        return {
          market: marketRow.market as PlayerPropMarket,
          totalForecasts: Number(marketRow.total),
          pending: Number(marketRow.pending || 0),
          settled: Number(marketRow.settled || 0),
          wins: Number(marketRow.wins || 0),
          losses: Number(marketRow.losses || 0),
          pushes: Number(marketRow.pushes || 0),
          hitRate: marketDecisive ? Number(marketRow.wins || 0) / marketDecisive : null,
          meanAbsoluteError: marketRow.meanAbsoluteError === null ? null : Number(marketRow.meanAbsoluteError),
          brierScore: marketRow.brierScore === null ? null : Number(marketRow.brierScore),
        };
      }),
      message: settled ? undefined : 'Ainda não há previsões apuradas. Os resultados aparecem após os jogos e a rotina diária de apuração.',
    });
  } catch (error) {
    console.error('[API/analysis/nba/performance] Failed:', error);
    return NextResponse.json({ error: 'Não foi possível carregar a avaliação do modelo.' }, { status: 500 });
  }
}
