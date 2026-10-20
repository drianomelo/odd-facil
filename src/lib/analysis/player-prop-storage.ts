import { PlayerPropCandidate } from '@/lib/analysis/player-props';
import { playerPropForecasts } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export const PLAYER_PROP_MODEL_VERSION = 'player-props-v0.5.0';

export async function storeUpcomingPlayerPropForecasts(candidates: PlayerPropCandidate[]) {
  if (!process.env.DATABASE_URL) return { enabled: false, saved: 0 };

  const now = Date.now();
  const rows = candidates.flatMap((candidate) => {
    const commenceTime = new Date(candidate.commenceTime);
    const side = candidate.recommendationSide;
    if (!side || !Number.isFinite(commenceTime.getTime()) || commenceTime.getTime() <= now) return [];

    const isOver = side === 'Over';
    const quote = isOver ? candidate.bestOver : candidate.bestUnder;
    const probability = isOver ? candidate.probabilityOver : candidate.probabilityUnder;
    const marketProbability = isOver ? candidate.marketProbabilityOver : candidate.marketProbabilityUnder;
    const expectedValue = isOver ? candidate.expectedValue : candidate.expectedValueUnder;

    return [{
      event_id: candidate.gameId,
      player_name: candidate.player,
      player_team: candidate.team ?? null,
      market: candidate.market,
      line: String(candidate.line),
      model_version: PLAYER_PROP_MODEL_VERSION,
      selection: side,
      projection: candidate.projection.toFixed(2),
      predicted_probability: probability.toFixed(4),
      market_probability: marketProbability?.toFixed(4) ?? null,
      american_odds: quote?.price ?? null,
      bookmaker: quote?.bookmaker ?? null,
      expected_value: expectedValue?.toFixed(4) ?? null,
      sample_size: candidate.sampleSize,
      confidence: candidate.confidence,
      shortlist_eligible: candidate.shortlistEligible,
      commence_time: commenceTime,
      details: {
        game: candidate.game,
        last5Average: candidate.last5Average,
        last10Average: candidate.last10Average,
        last20Average: candidate.last20Average,
        averageMinutes: candidate.averageMinutes ?? null,
        minutesTrend: candidate.minutesTrend ?? null,
        reasons: candidate.reasons,
        limitations: candidate.limitations,
        quotes: candidate.quotes,
      },
    }];
  });

  if (!rows.length) return { enabled: true, saved: 0 };

  const { db } = await import('@/lib/db');
  const inserted = await db.insert(playerPropForecasts).values(rows).onConflictDoUpdate({
    target: [playerPropForecasts.event_id, playerPropForecasts.player_name, playerPropForecasts.market, playerPropForecasts.line, playerPropForecasts.model_version],
    // Keep the original forecast snapshot intact while refreshing the quote set
    // used to validate a saved ticket against the same sportsbook.
    set: { details: sql`excluded.details` },
  }).returning({ id: playerPropForecasts.id });
  return { enabled: true, saved: inserted.length };
}
