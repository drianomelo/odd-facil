import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, isNull, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { playerPropForecasts } from '@/lib/db/schema';
import { PlayerGameLog } from '@/lib/analysis/player-props';
import { getGradeablePlayerPropUpdates, isTestPlayerPropForecast } from '@/lib/analysis/player-prop-grading';

const ACTIVE_MODEL_VERSION = 'player-props-v0.5.0';
const MAX_PLAYERS_PER_RUN = 100;

type PlayerLogsLoader = (player: string, limit?: number) => Promise<PlayerGameLog[]>;

export async function runPlayerPropGrading(request: NextRequest, loadLogs: PlayerLogsLoader) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!cronSecret || authorization !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.PROPLINE_API_KEY) {
    return NextResponse.json({ error: 'PropLine não configurada' }, { status: 503 });
  }

  try {
    const settledBefore = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const pending = await db.select({
      id: playerPropForecasts.id,
      eventId: playerPropForecasts.event_id,
      player: playerPropForecasts.player_name,
      modelVersion: playerPropForecasts.model_version,
      details: playerPropForecasts.details,
      market: playerPropForecasts.market,
      line: playerPropForecasts.line,
      selection: playerPropForecasts.selection,
    })
      .from(playerPropForecasts)
      .where(and(
        isNull(playerPropForecasts.result),
        lt(playerPropForecasts.commence_time, settledBefore),
        eq(playerPropForecasts.model_version, ACTIVE_MODEL_VERSION),
      ))
      .orderBy(asc(playerPropForecasts.commence_time))
      .limit(1000);

    const byPlayer = new Map<string, typeof pending>();
    for (const forecast of pending) {
      const rows = byPlayer.get(forecast.player) || [];
      rows.push(forecast);
      byPlayer.set(forecast.player, rows);
    }

    const players = Array.from(byPlayer.keys()).slice(0, MAX_PLAYERS_PER_RUN);
    let graded = 0;
    let voided = 0;
    let skippedTestForecasts = 0;
    let errors = 0;
    for (const player of players) {
      try {
        const logs = await loadLogs(player, 100);
        const playerForecasts = byPlayer.get(player) || [];
        const eligibleForecasts = playerForecasts.filter(forecast => {
          const isTest = isTestPlayerPropForecast(forecast.modelVersion, forecast.details);
          if (isTest) skippedTestForecasts++;
          return !isTest;
        });
        const updates = getGradeablePlayerPropUpdates(eligibleForecasts.map(forecast => ({
          id: forecast.id,
          eventId: forecast.eventId,
          market: forecast.market,
          line: Number(forecast.line),
          selection: forecast.selection as 'Over' | 'Under',
        })), logs);

        for (const update of updates) {
          const saved = await db.update(playerPropForecasts).set({
            actual_value: update.actual === undefined ? null : String(update.actual),
            result: update.result,
            graded_at: new Date(),
          }).where(and(
            isNull(playerPropForecasts.result),
            eq(playerPropForecasts.id, update.id),
            eq(playerPropForecasts.model_version, ACTIVE_MODEL_VERSION),
          )).returning({ id: playerPropForecasts.id });
          if (!saved.length) continue;
          if (update.result === 'void') voided++;
          else graded++;
        }
      } catch (error) {
        errors++;
        console.error(`[Cron/grade-player-props] Failed to grade ${player}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      pendingForecasts: pending.length,
      playersChecked: players.length,
      graded,
      voided,
      skippedTestForecasts,
      errors,
      remainingPlayers: Math.max(0, byPlayer.size - players.length),
    });
  } catch (error) {
    console.error('[Cron/grade-player-props] Failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Falha ao conferir resultados.',
    }, { status: 500 });
  }
}
