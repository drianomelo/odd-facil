import { NextRequest, NextResponse } from 'next/server';
import { and, count, desc, eq, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { playerPropForecasts } from '@/lib/db/schema';
import { PlayerPropMarket } from '@/lib/analysis/player-props';
import { PLAYER_PROP_MODEL_VERSION } from '@/lib/analysis/player-prop-storage';
import { NBA_REGULAR_SEASON_START } from '@/lib/analysis/nba-season';
import { NBA_PREDICTIONS_ENABLED } from '@/lib/analysis/prediction-controls';

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

export async function GET(request: NextRequest) {
  try {
    const team = request.nextUrl.searchParams.get('team');
    const player = request.nextUrl.searchParams.get('player');
    const regularSeasonOnly = sql`(${playerPropForecasts.commence_time} at time zone 'America/New_York')::date >= ${NBA_REGULAR_SEASON_START}::date`;
    const filters = [eq(playerPropForecasts.model_version, PLAYER_PROP_MODEL_VERSION), regularSeasonOnly];
    if (!NBA_PREDICTIONS_ENABLED) filters.push(lte(playerPropForecasts.commence_time, new Date()));
    if (team) filters.push(eq(playerPropForecasts.player_team, team));
    if (player) filters.push(eq(playerPropForecasts.player_name, player));
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
        marketProbability: playerPropForecasts.market_probability,
        expectedValue: playerPropForecasts.expected_value,
        shortlistEligible: playerPropForecasts.shortlist_eligible,
        americanOdds: playerPropForecasts.american_odds,
        bookmaker: playerPropForecasts.bookmaker,
        actualValue: playerPropForecasts.actual_value,
        result: playerPropForecasts.result,
        commenceTime: playerPropForecasts.commence_time,
        gradedAt: playerPropForecasts.graded_at,
        recordedAt: playerPropForecasts.recorded_at,
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
    const [[row], recentRows, playerTeamFacets] = await Promise.all([db.select({
      total: count(),
      pending: sql<number>`count(*) filter (where ${uniqueForecasts.result} is null)`,
      settled: sql<number>`count(*) filter (where ${uniqueForecasts.result} in ('won', 'lost', 'push', 'void'))`,
      wins: sql<number>`count(*) filter (where ${uniqueForecasts.result} = 'won')`,
      losses: sql<number>`count(*) filter (where ${uniqueForecasts.result} = 'lost')`,
      pushes: sql<number>`count(*) filter (where ${uniqueForecasts.result} = 'push')`,
      voids: sql<number>`count(*) filter (where ${uniqueForecasts.result} = 'void')`,
      gradedBets: sql<number>`count(*) filter (where ${uniqueForecasts.result} in ('won', 'lost'))`,
      betsWithOdds: sql<number>`count(*) filter (where ${uniqueForecasts.result} in ('won', 'lost') and ${uniqueForecasts.americanOdds} is not null)`,
      brierScore: sql<number>`avg(power(${uniqueForecasts.predictedProbability} - case when ${uniqueForecasts.result} = 'won' then 1 else 0 end, 2)) filter (where ${uniqueForecasts.result} in ('won', 'lost'))`,
      netUnits: sql<number>`coalesce(sum(case
        when ${uniqueForecasts.result} = 'won' and ${uniqueForecasts.americanOdds} > 0 then ${uniqueForecasts.americanOdds}::numeric / 100
        when ${uniqueForecasts.result} = 'won' and ${uniqueForecasts.americanOdds} < 0 then 100::numeric / abs(${uniqueForecasts.americanOdds})
        when ${uniqueForecasts.result} = 'lost' and ${uniqueForecasts.americanOdds} is not null then -1
        else 0 end), 0)`,
    }).from(uniqueForecasts), db.select({
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
      actualValue: uniqueForecasts.actualValue,
      result: uniqueForecasts.result,
      commenceTime: uniqueForecasts.commenceTime,
      gradedAt: uniqueForecasts.gradedAt,
      details: uniqueForecasts.details,
    }).from(uniqueForecasts).where(
      inArray(uniqueForecasts.result, ['won', 'lost', 'push', 'void']),
    ).orderBy(desc(uniqueForecasts.gradedAt), desc(uniqueForecasts.commenceTime)).limit(50),
    db.selectDistinct({ team: playerPropForecasts.player_team, player: playerPropForecasts.player_name })
      .from(playerPropForecasts)
      .where(and(eq(playerPropForecasts.model_version, PLAYER_PROP_MODEL_VERSION), regularSeasonOnly, isNotNull(playerPropForecasts.player_team)))
    ]);

    const marketRows = await db.select({
      market: uniqueForecasts.market,
      total: count(),
      pending: sql<number>`count(*) filter (where ${uniqueForecasts.result} is null)`,
      settled: sql<number>`count(*) filter (where ${uniqueForecasts.result} in ('won', 'lost', 'push', 'void'))`,
      wins: sql<number>`count(*) filter (where ${uniqueForecasts.result} = 'won')`,
      losses: sql<number>`count(*) filter (where ${uniqueForecasts.result} = 'lost')`,
      pushes: sql<number>`count(*) filter (where ${uniqueForecasts.result} = 'push')`,
      meanAbsoluteError: sql<number>`avg(abs(${uniqueForecasts.actualValue} - ${uniqueForecasts.projection})) filter (where ${uniqueForecasts.actualValue} is not null)`,
      validationSample: sql<number>`count(*) filter (where ${uniqueForecasts.result} in ('won', 'lost') and ${uniqueForecasts.marketProbability} is not null)`,
      validationGameDays: sql<number>`count(distinct (${uniqueForecasts.commenceTime} at time zone 'America/New_York')::date) filter (where ${uniqueForecasts.result} in ('won', 'lost') and ${uniqueForecasts.marketProbability} is not null)`,
      brierScore: sql<number>`avg(power(${uniqueForecasts.predictedProbability} - case when ${uniqueForecasts.result} = 'won' then 1 else 0 end, 2)) filter (where ${uniqueForecasts.result} in ('won', 'lost') and ${uniqueForecasts.marketProbability} is not null)`,
      marketBrierScore: sql<number>`avg(power(${uniqueForecasts.marketProbability} - case when ${uniqueForecasts.result} = 'won' then 1 else 0 end, 2)) filter (where ${uniqueForecasts.result} in ('won', 'lost') and ${uniqueForecasts.marketProbability} is not null)`,
      betsWithOdds: sql<number>`count(*) filter (where ${uniqueForecasts.result} in ('won', 'lost') and ${uniqueForecasts.americanOdds} is not null)`,
      netUnits: sql<number>`coalesce(sum(case
        when ${uniqueForecasts.result} = 'won' and ${uniqueForecasts.americanOdds} > 0 then ${uniqueForecasts.americanOdds}::numeric / 100
        when ${uniqueForecasts.result} = 'won' and ${uniqueForecasts.americanOdds} < 0 then 100::numeric / abs(${uniqueForecasts.americanOdds})
        when ${uniqueForecasts.result} = 'lost' and ${uniqueForecasts.americanOdds} is not null then -1
        else 0 end), 0)`,
    }).from(uniqueForecasts)
      .groupBy(uniqueForecasts.market);

    const settled = Number(row?.settled || 0);
    const decisive = Number(row?.wins || 0) + Number(row?.losses || 0);
    const betsWithOdds = Number(row?.betsWithOdds || 0);
    const netUnits = Number(row?.netUnits || 0);
    return NextResponse.json({
      totalForecasts: Number(row?.total || 0),
      modelVersion: PLAYER_PROP_MODEL_VERSION,
      filters: { team: team || 'all', player: player || 'all' },
      playerTeamFacets: playerTeamFacets.filter(item => item.team),
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
        const validationSample = Number(marketRow.validationSample || 0);
        const validationGameDays = Number(marketRow.validationGameDays || 0);
        const marketBrierScore = marketRow.marketBrierScore === null ? null : Number(marketRow.marketBrierScore);
        const modelBrierScore = marketRow.brierScore === null ? null : Number(marketRow.brierScore);
        const betsWithOdds = Number(marketRow.betsWithOdds || 0);
        const netUnits = Number(marketRow.netUnits || 0);
        const roiPercent = betsWithOdds ? netUnits / betsWithOdds * 100 : null;
        // Conservative operational threshold, not a universal statistical guarantee.
        const enoughValidationData = validationSample >= 250 && validationGameDays >= 30 && betsWithOdds >= 250;
        const validationStatus = !enoughValidationData ? 'insufficient'
          : modelBrierScore !== null && marketBrierScore !== null
            && modelBrierScore <= marketBrierScore * 0.95 && roiPercent !== null && roiPercent > 0
            ? 'validated' : 'evaluated';
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
          brierScore: modelBrierScore,
          marketBrierScore,
          validationSample,
          validationGameDays,
          validationStatus,
          validationRoiPercent: roiPercent,
        };
      }),
      message: settled ? undefined : 'Ainda não há previsões apuradas. Os resultados aparecem após os jogos e a rotina diária de apuração.',
    });
  } catch (error) {
    console.error('[API/analysis/nba/performance] Failed:', error);
    return NextResponse.json({ error: 'Não foi possível carregar a avaliação do modelo.' }, { status: 500 });
  }
}
