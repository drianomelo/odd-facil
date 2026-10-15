import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { conn, db } from '@/lib/db';
import { creditUsage, games, odds, modelPredictions, opportunities, teams, settings } from '@/lib/db/schema';
import { eq, and, gte, lt, sql, desc } from 'drizzle-orm';
import { oddsApiClient } from '@/lib/api/odds-api';
import { getDailyPlayerAnalysis } from '@/lib/api/propline';
import { storeUpcomingPlayerPropForecasts } from '@/lib/analysis/player-prop-storage';
import { basketballModel } from '@/lib/analysis/model';
import { 
  impliedProbability, marginFreeProbabilities, expectedValue, fairOdds, evPercentage,
  selectionsMatch, normalizeLine
} from '@/lib/utils/math';
import { isGameStarted, formatAppDateTime, APP_TIMEZONE } from '@/lib/utils/date';
import { parseISO } from 'date-fns';

const CRON_SECRET = process.env.CRON_SECRET;
const MONTHLY_CREDIT_LIMIT = parseInt(process.env.MONTHLY_CREDIT_LIMIT || '400', 10);
const MIN_EV_THRESHOLD = parseFloat(process.env.MIN_EV_THRESHOLD || '0.05');
const MIN_DATA_COMPLETENESS = parseFloat(process.env.MIN_DATA_COMPLETENESS || '0.6');
const MAX_ODDS_AGE_HOURS = parseInt(process.env.MAX_ODDS_AGE_HOURS || '12', 10);
const MAX_OPPORTUNITIES = parseInt(process.env.MAX_OPPORTUNITIES || '5', 10);

interface CronResult {
  success: boolean;
  message: string;
  gamesFound: number;
  gamesAnalyzed: number;
  opportunitiesFound: number;
  opportunitiesQualified: number;
  creditsUsed: number;
  creditsRemaining: number;
  playerPropForecastsSaved: number;
  errors: string[];
}

async function checkCreditBudget(): Promise<{ allowed: boolean; used: number; remaining: number }> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const result = await db.select({ total: sql<number>`sum(${creditUsage.credits_used})` })
    .from(creditUsage)
    .where(gte(creditUsage.date, startOfMonth));
  
  const used = result[0]?.total || 0;
  const remaining = MONTHLY_CREDIT_LIMIT - used;
  
  return { allowed: remaining > 0, used, remaining };
}

async function recordCreditUsage(endpoint: string, credits: number, remaining: number) {
  await db.insert(creditUsage).values({
    endpoint,
    credits_used: credits,
    remaining,
  });
}

async function acquireLock(): Promise<boolean> {
  const result = await conn.unsafe<{ acquired: boolean }[]>(
    'SELECT pg_try_advisory_lock(123456789) as acquired'
  );
  return result[0]?.acquired === true;
}

async function releaseLock() {
  await conn.unsafe('SELECT pg_advisory_unlock(123456789)');
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const errors: string[] = [];
  let result: CronResult = {
    success: false,
    message: '',
    gamesFound: 0,
    gamesAnalyzed: 0,
    opportunitiesFound: 0,
    opportunitiesQualified: 0,
    creditsUsed: 0,
    creditsRemaining: 0,
    playerPropForecastsSaved: 0,
    errors,
  };

  const authHeader = headers().get('authorization');
  const providedSecret = authHeader?.replace('Bearer ', '');
  
  if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lockAcquired = await acquireLock();
  if (!lockAcquired) {
    return NextResponse.json({ 
      error: 'Another cron job is running',
      success: false 
    }, { status: 409 });
  }

  try {
    console.log('[Cron] Starting cron job');
    const today = new Date();
    const windowEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (process.env.PROPLINE_API_KEY) {
      try {
        const analysis = await getDailyPlayerAnalysis(today, windowEnd);
        const tracking = await storeUpcomingPlayerPropForecasts(analysis.recommendations);
        result.playerPropForecastsSaved = tracking.saved;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao registrar previsões de props.';
        errors.push(`Player props: ${message}`);
      }
    }

    const budget = await checkCreditBudget();
    console.log('[Cron] Budget check:', budget);
    if (!budget.allowed) {
      result.message = `Orçamento mensal esgotado (${budget.used}/${MONTHLY_CREDIT_LIMIT})`;
      result.creditsUsed = budget.used;
      result.creditsRemaining = 0;
      return NextResponse.json(result, { status: 429 });
    }

    console.log('[Cron] Fetching NBA games through:', windowEnd.toISOString());
    
    const { games: apiGames, creditsUsed, creditsRemaining } = await oddsApiClient.getNbaGames(today, windowEnd);
    console.log('[Cron] Got games:', apiGames.length, 'credits used:', creditsUsed);
    const upcomingGames = apiGames.filter(game => {
      const commence = new Date(game.commence_time);
      return commence > today && commence <= windowEnd;
    });
    console.log('[Cron] Upcoming games in seven-day window:', upcomingGames.length);
    
    await recordCreditUsage('odds-api-games', creditsUsed, creditsRemaining);
    
    result.creditsUsed = budget.used + creditsUsed;
    result.creditsRemaining = creditsRemaining;
    result.gamesFound = apiGames.length;

    const scheduledGames = upcomingGames.filter(g => g.status === 'scheduled' && !isGameStarted(g.commence_time));
    console.log('[Cron] Scheduled games in window:', scheduledGames.length);
    result.gamesAnalyzed = scheduledGames.length;

    for (const game of scheduledGames) {
      try {
        console.log('[Cron] Processing game:', game.id);
        await upsertGame(game);
        await upsertOdds(game);
        
        const modelInput = buildModelInput(game);
        const prediction = basketballModel.analyze(modelInput);
        const enriched = basketballModel.enrichWithOdds(prediction, game.markets);
        
        await savePrediction(enriched);
        const qualified = await evaluateAndSaveOpportunities(enriched, game);
        
        result.opportunitiesFound += enriched.markets.reduce((sum, m) => sum + m.selections.length, 0);
        result.opportunitiesQualified += qualified;
      } catch (error) {
        errors.push(`Game ${game.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    result.success = true;
    result.message = `Atualização concluída em ${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    console.log('[Cron] Completed:', result.message);
  } catch (error) {
    result.message = error instanceof Error ? error.message : 'Erro desconhecido';
    errors.push(result.message);
    console.error('[Cron] Error:', error);
  } finally {
    await releaseLock();
  }

  return NextResponse.json(result);
}

async function upsertGame(game: any) {
  let homeTeam = await db.select().from(teams).where(and(eq(teams.external_id, game.home_team.id), eq(teams.league_id, 'NBA'))).limit(1);
  if (homeTeam.length === 0) {
    const inserted = await db.insert(teams).values({
      external_id: game.home_team.id,
      league_id: 'NBA',
      name: game.home_team.name,
      abbreviation: game.home_team.abbreviation,
    }).returning();
    homeTeam = inserted;
  }

  let awayTeam = await db.select().from(teams).where(and(eq(teams.external_id, game.away_team.id), eq(teams.league_id, 'NBA'))).limit(1);
  if (awayTeam.length === 0) {
    const inserted = await db.insert(teams).values({
      external_id: game.away_team.id,
      league_id: 'NBA',
      name: game.away_team.name,
      abbreviation: game.away_team.abbreviation,
    }).returning();
    awayTeam = inserted;
  }

  await db.insert(games).values({
    external_id: game.id.replace('nba-', ''),
    league_id: 'NBA',
    home_team_id: homeTeam[0].id,
    away_team_id: awayTeam[0].id,
    commence_time: new Date(game.commence_time),
    status: game.status,
    updated_at: new Date(game.updated_at),
  }).onConflictDoUpdate({
    target: games.external_id,
    set: {
      status: game.status,
      home_score: game.home_score,
      away_score: game.away_score,
      updated_at: new Date(game.updated_at),
    },
  });
}

async function upsertOdds(game: any) {
  const dbGame = await db.select().from(games).where(eq(games.external_id, game.id.replace('nba-', ''))).limit(1);
  if (dbGame.length === 0) return;

  const gameId = dbGame[0].id;
  const collectedAt = new Date();

  for (const market of game.markets) {
    for (const [selection, oddsList] of Object.entries(market.selections)) {
      for (const odd of oddsList as any[]) {
        await db.insert(odds).values({
          game_id: gameId,
          bookmaker_key: odd.bookmaker_key,
          bookmaker_title: odd.bookmaker,
          market: market.market,
          line: odd.line?.toString() || market.line?.toString() || null,
          selection,
          odds: odd.odds.toString(),
          collected_at: collectedAt,
          bookmaker_last_update: new Date(odd.collected_at),
        }).onConflictDoNothing();
      }
    }
  }
}

function buildModelInput(game: any) {
  const homeStats = getTeamStats(game.home_team.id);
  const awayStats = getTeamStats(game.away_team.id);
  
  const commence = parseISO(game.commence_time);
  const now = new Date();
  const restDays = { home: 2, away: 2 };
  const backToBack = { home: false, away: false };

  return {
    game_id: game.id,
    home_team: game.home_team,
    away_team: game.away_team,
    commence_time: game.commence_time,
    home_stats: homeStats,
    away_stats: awayStats,
    rest_days: restDays,
    back_to_back: backToBack,
  };
}

function getTeamStats(teamId: string): import('@/types').TeamStats | undefined {
  return undefined;
}

async function savePrediction(prediction: any) {
  for (const market of prediction.markets) {
    for (const selection of market.selections) {
      await db.insert(modelPredictions).values({
        game_id: prediction.game_id.replace('nba-', ''),
        model_version: prediction.model_version,
        market: market.market,
        line: market.line?.toString() || null,
        selection: selection.selection,
        estimated_probability: selection.estimated_probability.toString(),
        uncertainty: selection.uncertainty.toString(),
        fair_odds: selection.fair_odds.toString(),
        best_odds: selection.best_odds?.toString() || null,
        best_bookmaker: selection.best_bookmaker || null,
        expected_value: selection.expected_value?.toString() || null,
        data_completeness: prediction.data_completeness.toString(),
        factors: selection.factors,
        computed_at: new Date(prediction.computed_at),
      }).onConflictDoNothing();
    }
  }
}

async function evaluateAndSaveOpportunities(prediction: any, game: any): Promise<number> {
  let qualified = 0;
  const allOpportunities: any[] = [];

  for (const market of prediction.markets) {
    for (const selection of market.selections) {
      if (selection.best_odds && selection.expected_value !== undefined) {
        allOpportunities.push({
          ...selection,
          market: market.market,
          line: market.line,
          game,
        });
      }
    }
  }

  allOpportunities.sort((a, b) => b.expected_value - a.expected_value);

  for (const opp of allOpportunities.slice(0, MAX_OPPORTUNITIES)) {
    const qualifiedFlag = opp.expected_value >= MIN_EV_THRESHOLD && prediction.data_completeness >= MIN_DATA_COMPLETENESS;
    const reason = !qualifiedFlag 
      ? (opp.expected_value < MIN_EV_THRESHOLD ? `EV ${(opp.expected_value * 100).toFixed(1)}% < ${(MIN_EV_THRESHOLD * 100).toFixed(1)}%` : `Completude ${(prediction.data_completeness * 100).toFixed(0)}% < ${(MIN_DATA_COMPLETENESS * 100).toFixed(0)}%`)
      : undefined;

    await db.insert(opportunities).values({
      game_id: game.id.replace('nba-', ''),
      market: opp.market,
      line: opp.line?.toString() || null,
      selection: opp.selection,
      bookmaker: opp.best_bookmaker,
      odds: opp.best_odds.toString(),
      estimated_probability: opp.estimated_probability.toString(),
      fair_odds: opp.fair_odds.toString(),
      expected_value: opp.expected_value.toString(),
      ev_percentage: opp.ev_percentage.toString(),
      data_completeness: prediction.data_completeness.toString(),
      factors: opp.factors,
      qualified: qualifiedFlag,
      qualification_reason: reason,
      collected_at: new Date(),
      model_version: prediction.model_version,
    }).onConflictDoNothing();

    if (qualifiedFlag) qualified++;
  }

  return qualified;
}
