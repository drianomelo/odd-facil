import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { opportunities, games, teams, modelPredictions } from '@/lib/db/schema';
import { eq, and, desc, gte, lt, sql } from 'drizzle-orm';
import { isGameStarted } from '@/lib/utils/date';
import { alias } from 'drizzle-orm/pg-core';

const homeTeam = alias(teams, 'home_team');
const awayTeam = alias(teams, 'away_team');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const qualified = searchParams.get('qualified');
  const market = searchParams.get('market');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const startOfDay = new Date(date + 'T00:00:00');
  const endOfDay = new Date(date + 'T23:59:59');

  try {
    const baseQuery = db
      .select({
        opportunity: opportunities,
        game: games,
        homeTeam: homeTeam,
        awayTeam: awayTeam,
      })
      .from(opportunities)
      .innerJoin(games, eq(opportunities.game_id, games.id))
      .innerJoin(homeTeam, eq(games.home_team_id, homeTeam.id))
      .innerJoin(awayTeam, eq(games.away_team_id, awayTeam.id))
      .where(and(
        gte(games.commence_time, startOfDay),
        lt(games.commence_time, endOfDay),
        eq(games.status, 'scheduled')
      ))
      .orderBy(desc(opportunities.expected_value))
      .limit(limit);

    const results = await baseQuery;

    const filtered = results
      .filter(r => !isGameStarted(r.game.commence_time.toISOString()))
      .filter(r => qualified === null || r.opportunity.qualified === (qualified === 'true'))
      .filter(r => !market || r.opportunity.market === market);

    return NextResponse.json({
      opportunities: filtered.map(r => ({
        id: r.opportunity.id,
        game_id: r.game.id,
        game: {
          id: r.game.id,
          commence_time: r.game.commence_time,
          status: r.game.status,
          home_team: { id: r.homeTeam.id, name: r.homeTeam.name, abbreviation: r.homeTeam.abbreviation },
          away_team: { id: r.awayTeam.id, name: r.awayTeam.name, abbreviation: r.awayTeam.abbreviation },
        },
        market: r.opportunity.market,
        line: r.opportunity.line ? parseFloat(r.opportunity.line) : null,
        selection: r.opportunity.selection,
        bookmaker: r.opportunity.bookmaker,
        odds: parseFloat(r.opportunity.odds),
        estimated_probability: r.opportunity.estimated_probability ? parseFloat(r.opportunity.estimated_probability) : null,
        fair_odds: r.opportunity.fair_odds ? parseFloat(r.opportunity.fair_odds) : null,
        expected_value: parseFloat(r.opportunity.expected_value),
        ev_percentage: parseFloat(r.opportunity.ev_percentage),
        data_completeness: parseFloat(r.opportunity.data_completeness),
        factors: r.opportunity.factors,
        qualified: r.opportunity.qualified,
        qualification_reason: r.opportunity.qualification_reason,
        collected_at: r.opportunity.collected_at,
        model_version: r.opportunity.model_version,
      })),
      count: filtered.length,
    });
  } catch (error) {
    console.error('[API/opportunities] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error', stack: error instanceof Error ? error.stack : undefined }, { status: 500 });
  }
}