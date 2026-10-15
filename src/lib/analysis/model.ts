import { 
  ModelInput, ModelOutput, MarketPrediction, SelectionPrediction, 
  TeamStats, Factor, MarketType, SelectionType, DataFreshness, MarketOdds 
} from '@/types';
import { 
  impliedProbability, marginFreeProbabilities, expectedValue, fairOdds, evPercentage 
} from '@/lib/utils/math';

const MODEL_VERSION = 'v1.0.0-simple-poisson';

const LEAGUE_AVERAGES = {
  NBA: {
    offensive_rating: 115.0,
    defensive_rating: 115.0,
    pace: 98.0,
    efg_pct: 0.545,
    tov_pct: 0.145,
    orb_pct: 0.285,
    ft_rate: 0.225,
  },
};

const HOME_COURT_ADVANTAGE = 2.8;
const REST_DAY_VALUE = 0.6;
const BACK_TO_BACK_PENALTY = -1.2;
const MIN_GAMES_FOR_STATS = 10;
const REGRESSION_WEIGHT = 0.3;

export class BasketballModel {
  private leagueAverages = LEAGUE_AVERAGES.NBA;

  analyze(input: ModelInput): ModelOutput {
    const warnings: string[] = [];
    let dataCompleteness = 0;

    const hasHomeStats = !!input.home_stats && input.home_stats!.games_played >= MIN_GAMES_FOR_STATS;
    const hasAwayStats = !!input.away_stats && input.away_stats!.games_played >= MIN_GAMES_FOR_STATS;

    if (!hasHomeStats) warnings.push('Estatísticas do mandante insuficientes (mín. 10 jogos)');
    if (!hasAwayStats) warnings.push('Estatísticas do visitante insuficientes (mín. 10 jogos)');
    if (!input.injuries || input.injuries.length === 0) warnings.push('Dados de lesões indisponíveis');
    
    dataCompleteness = (hasHomeStats ? 0.35 : 0.1) + (hasAwayStats ? 0.35 : 0.1) + (input.injuries && input.injuries.length > 0 ? 0.15 : 0) + 0.15;

    const markets: MarketPrediction[] = [];

    if (hasHomeStats && hasAwayStats) {
      markets.push(this.predictH2H(input));
      markets.push(this.predictSpread(input));
      markets.push(this.predictTotal(input));
    } else {
      warnings.push('Dados insuficientes para estimar valor - apenas comparação de odds disponível');
    }

    return {
      game_id: input.game_id,
      model_version: MODEL_VERSION,
      computed_at: new Date().toISOString(),
      data_completeness: Math.round(dataCompleteness * 100) / 100,
      markets,
      warnings,
    };
  }

  private predictH2H(input: ModelInput): MarketPrediction {
    const { home_stats, away_stats, rest_days, back_to_back } = input;
    const homeORtg = this.regressToMean(home_stats!.offensive_rating, this.leagueAverages.offensive_rating, home_stats!.games_played);
    const homeDRtg = this.regressToMean(home_stats!.defensive_rating, this.leagueAverages.defensive_rating, home_stats!.games_played);
    const awayORtg = this.regressToMean(away_stats!.offensive_rating, this.leagueAverages.offensive_rating, away_stats!.games_played);
    const awayDRtg = this.regressToMean(away_stats!.defensive_rating, this.leagueAverages.defensive_rating, away_stats!.games_played);

    const pace = (home_stats!.pace + away_stats!.pace) / 2;
    
    const homeExpectedPoints = (homeORtg / 100) * pace * (awayDRtg / this.leagueAverages.defensive_rating);
    const awayExpectedPoints = (awayORtg / 100) * pace * (homeDRtg / this.leagueAverages.offensive_rating);

    let homeAdj = homeExpectedPoints + HOME_COURT_ADVANTAGE;
    let awayAdj = awayExpectedPoints;

    homeAdj += rest_days.home * REST_DAY_VALUE;
    awayAdj += rest_days.away * REST_DAY_VALUE;
    if (back_to_back.home) homeAdj += BACK_TO_BACK_PENALTY;
    if (back_to_back.away) awayAdj += BACK_TO_BACK_PENALTY;

    const margin = homeAdj - awayAdj;
    const homeWinProb = this.normalCdf(margin, 0, 11.5);
    const awayWinProb = 1 - homeWinProb;

    const factors: Factor[] = [
      { type: 'favorable', label: 'Vantagem de mando', description: `+${HOME_COURT_ADVANTAGE.toFixed(1)} pts estimados`, impact: 'medium' },
      { type: 'favorable', label: 'Diferença de rating', description: `${(homeORtg - homeDRtg - (awayORtg - awayDRtg)).toFixed(1)} pts líquidos`, impact: 'high' },
    ];

    if (rest_days.home !== rest_days.away) {
      factors.push({ 
        type: rest_days.home > rest_days.away ? 'favorable' : 'uncertainty',
        label: 'Diferença de descanso',
        description: `${rest_days.home - rest_days.away} dias a mais para ${rest_days.home > rest_days.away ? 'mandante' : 'visitante'}`,
        impact: 'medium'
      });
    }

    if (back_to_back.home || back_to_back.away) {
      factors.push({ 
        type: 'uncertainty',
        label: 'Back-to-back',
        description: `${back_to_back.home ? 'Mandante' : ''}${back_to_back.away ? ' Visitante' : ''} em jogos consecutivos`,
        impact: 'medium'
      });
    }

    factors.push({ 
      type: 'limitation', 
      label: 'Modelo simplificado', 
      description: 'Poisson básico sem ajustes de confrontos diretos, lesões ou escalações', 
      impact: 'high' 
    });

    const selections: SelectionPrediction[] = [
      this.createSelection('home', homeWinProb, 'home', factors),
      this.createSelection('away', awayWinProb, 'away', factors),
    ];

    return {
      market: 'h2h',
      selections,
      fair_odds: { 
        home: fairOdds(homeWinProb), 
        away: fairOdds(awayWinProb),
        over: 0,
        under: 0,
        home_spread: 0,
        away_spread: 0,
      } as Record<SelectionType, number>,
      margin: 0,
    };
  }

  private predictSpread(input: ModelInput): MarketPrediction {
    const { home_stats, away_stats, rest_days, back_to_back } = input;
    const homeORtg = this.regressToMean(home_stats!.offensive_rating, this.leagueAverages.offensive_rating, home_stats!.games_played);
    const homeDRtg = this.regressToMean(home_stats!.defensive_rating, this.leagueAverages.defensive_rating, home_stats!.games_played);
    const awayORtg = this.regressToMean(away_stats!.offensive_rating, this.leagueAverages.offensive_rating, away_stats!.games_played);
    const awayDRtg = this.regressToMean(away_stats!.defensive_rating, this.leagueAverages.defensive_rating, away_stats!.games_played);

    const pace = (home_stats!.pace + away_stats!.pace) / 2;
    const homeExpectedPoints = (homeORtg / 100) * pace * (awayDRtg / this.leagueAverages.defensive_rating);
    const awayExpectedPoints = (awayORtg / 100) * pace * (homeDRtg / this.leagueAverages.offensive_rating);

    let predictedMargin = homeExpectedPoints - awayExpectedPoints + HOME_COURT_ADVANTAGE;
    predictedMargin += (rest_days.home - rest_days.away) * REST_DAY_VALUE;
    if (back_to_back.home) predictedMargin += BACK_TO_BACK_PENALTY;
    if (back_to_back.away) predictedMargin -= BACK_TO_BACK_PENALTY;

    const spreadStdDev = 11.5;
    const homeCoverProb = this.normalCdf(predictedMargin, 0, spreadStdDev);
    const awayCoverProb = 1 - homeCoverProb;

    const factors: Factor[] = [
      { type: 'favorable', label: 'Margem projetada', description: `${predictedMargin.toFixed(1)} pts`, impact: 'high' },
      { type: 'limitation', label: 'Desvio padrão fixo', description: '11.5 pts baseado em média histórica NBA', impact: 'medium' },
      { type: 'limitation', label: 'Sem ajuste de lesões', description: 'Impacto de desfalques não quantificado', impact: 'high' },
    ];

    const selections: SelectionPrediction[] = [
      this.createSelection('home_spread', homeCoverProb, 'home_spread', factors),
      this.createSelection('away_spread', awayCoverProb, 'away_spread', factors),
    ];

    return {
      market: 'spreads',
      line: 0,
      selections,
      fair_odds: { 
        home_spread: fairOdds(homeCoverProb), 
        away_spread: fairOdds(awayCoverProb),
        home: 0,
        away: 0,
        over: 0,
        under: 0,
      } as Record<SelectionType, number>,
      margin: 0,
    };
  }

  private predictTotal(input: ModelInput): MarketPrediction {
    const { home_stats, away_stats, rest_days, back_to_back } = input;
    const homeORtg = this.regressToMean(home_stats!.offensive_rating, this.leagueAverages.offensive_rating, home_stats!.games_played);
    const homeDRtg = this.regressToMean(home_stats!.defensive_rating, this.leagueAverages.defensive_rating, home_stats!.games_played);
    const awayORtg = this.regressToMean(away_stats!.offensive_rating, this.leagueAverages.offensive_rating, away_stats!.games_played);
    const awayDRtg = this.regressToMean(away_stats!.defensive_rating, this.leagueAverages.defensive_rating, away_stats!.games_played);

    const pace = (home_stats!.pace + away_stats!.pace) / 2;
    const homeExpectedPoints = (homeORtg / 100) * pace * (awayDRtg / this.leagueAverages.defensive_rating);
    const awayExpectedPoints = (awayORtg / 100) * pace * (homeDRtg / this.leagueAverages.offensive_rating);

    let predictedTotal = homeExpectedPoints + awayExpectedPoints;
    predictedTotal += (rest_days.home + rest_days.away) * REST_DAY_VALUE * 0.5;
    if (back_to_back.home) predictedTotal += BACK_TO_BACK_PENALTY * 0.5;
    if (back_to_back.away) predictedTotal += BACK_TO_BACK_PENALTY * 0.5;

    const totalStdDev = 13.5;
    const overProb = this.normalCdf(predictedTotal, 0, totalStdDev);
    const underProb = 1 - overProb;

    const factors: Factor[] = [
      { type: 'favorable', label: 'Total projetado', description: `${predictedTotal.toFixed(1)} pts`, impact: 'high' },
      { type: 'favorable', label: 'Ritmo combinado', description: `${pace.toFixed(1)} posses/jogo`, impact: 'medium' },
      { type: 'limitation', label: 'Desvio padrão fixo', description: '13.5 pts baseado em média histórica NBA', impact: 'medium' },
      { type: 'limitation', label: 'Sem ajuste de lesões', description: 'Impacto de desfalques não quantificado', impact: 'high' },
    ];

    const selections: SelectionPrediction[] = [
      this.createSelection('over', overProb, 'over', factors),
      this.createSelection('under', underProb, 'under', factors),
    ];

    return {
      market: 'totals',
      line: 0,
      selections,
      fair_odds: { 
        over: fairOdds(overProb), 
        under: fairOdds(underProb),
        home: 0,
        away: 0,
        home_spread: 0,
        away_spread: 0,
      } as Record<SelectionType, number>,
      margin: 0,
    };
  }

  private createSelection(
    selection: SelectionType, 
    probability: number, 
    _key: string,
    factors: Factor[]
  ): SelectionPrediction {
    const uncertainty = Math.min(0.15 + (1 - probability) * 0.1, 0.25);
    return {
      selection,
      estimated_probability: Math.round(probability * 10000) / 10000,
      uncertainty: Math.round(uncertainty * 10000) / 10000,
      fair_odds: 0,
      best_odds: 0,
      best_bookmaker: '',
      expected_value: 0,
      ev_percentage: 0,
      data_quality: 'current',
      factors: [...factors],
    };
  }

  private regressToMean(value: number, mean: number, gamesPlayed: number): number {
    const weight = Math.min(gamesPlayed / 82, 1) * (1 - REGRESSION_WEIGHT) + REGRESSION_WEIGHT;
    return value * weight + mean * (1 - weight);
  }

  private normalCdf(x: number, mean: number, stdDev: number): number {
    const z = (x - mean) / (stdDev * Math.sqrt(2));
    const t = 1 / (1 + 0.3275911 * Math.abs(z));
    const erf = 1 - ((((1.0614054 * t - 1.453152) * t + 1.4214137) * t - 0.2844967) * t + 0.2548296) * t * Math.exp(-z * z);
    return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
  }

  enrichWithOdds(prediction: ModelOutput, gameOdds: MarketOdds[]): ModelOutput {
    for (const marketPred of prediction.markets) {
      const oddsMarket = gameOdds.find(m => m.market === marketPred.market && m.line === marketPred.line);
      if (!oddsMarket) continue;

      for (const selection of marketPred.selections) {
        const bestOdd = oddsMarket.best_odds[selection.selection];
        if (bestOdd) {
          selection.best_odds = bestOdd.odds;
          selection.best_bookmaker = bestOdd.bookmaker;
          selection.data_quality = bestOdd.freshness;
          selection.fair_odds = fairOdds(selection.estimated_probability);
          selection.expected_value = expectedValue(selection.estimated_probability, bestOdd.odds);
          selection.ev_percentage = evPercentage(selection.expected_value);
        }
      }
    }
    return prediction;
  }
}

export const basketballModel = new BasketballModel();
export { MODEL_VERSION };