export type League = 'NBA';

export type MarketType = 'h2h' | 'spreads' | 'totals';

export type SelectionType = 
  | 'home' 
  | 'away' 
  | 'over' 
  | 'under' 
  | 'home_spread' 
  | 'away_spread';

export type GameStatus = 'scheduled' | 'live' | 'finished' | 'cancelled' | 'postponed';

export type DataFreshness = 'current' | 'stale' | 'unavailable';

export type ModelVersion = string;

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  league: League;
}

export interface Bookmaker {
  key: string;
  title: string;
  last_update: string;
}

export interface Odd {
  bookmaker: string;
  bookmaker_key: string;
  market: MarketType;
  selection: SelectionType;
  line?: number;
  odds: number;
  collected_at: string;
  freshness: DataFreshness;
}

export interface MarketOdds {
  market: MarketType;
  line?: number;
  selections: Record<SelectionType, Odd[]>;
  best_odds: Record<SelectionType, Odd>;
  fair_probabilities?: Partial<Record<SelectionType, number>>;
}

export interface Game {
  id: string;
  league: League;
  home_team: Team;
  away_team: Team;
  commence_time: string;
  status: GameStatus;
  home_score?: number;
  away_score?: number;
  markets: MarketOdds[];
  updated_at: string;
}

export interface ImpliedProbability {
  selection: SelectionType;
  probability: number;
  odds: number;
  bookmaker: string;
  margin_free: number;
}

export interface ModelInput {
  game_id: string;
  home_team: Team;
  away_team: Team;
  commence_time: string;
  home_stats?: TeamStats;
  away_stats?: TeamStats;
  h2h_history?: H2HRecord[];
  injuries?: InjuryReport[];
  rest_days: { home: number; away: number };
  back_to_back: { home: boolean; away: boolean };
}

export interface TeamStats {
  team_id: string;
  season: string;
  games_played: number;
  offensive_rating: number;
  defensive_rating: number;
  pace: number;
  efg_pct: number;
  tov_pct: number;
  orb_pct: number;
  ft_rate: number;
  opponent_adjusted: boolean;
  last_updated: string;
  sample_size: number;
}

export interface H2HRecord {
  date: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  location: 'home' | 'away' | 'neutral';
}

export interface InjuryReport {
  player_id: string;
  player_name: string;
  team_id: string;
  status: 'out' | 'doubtful' | 'questionable' | 'probable';
  injury: string;
  reported_at: string;
  source: string;
}

export interface ModelOutput {
  game_id: string;
  model_version: ModelVersion;
  computed_at: string;
  data_completeness: number;
  markets: MarketPrediction[];
  warnings: string[];
}

export interface MarketPrediction {
  market: MarketType;
  line?: number;
  selections: SelectionPrediction[];
  fair_odds: Record<SelectionType, number>;
  margin: number;
}

export interface SelectionPrediction {
  selection: SelectionType;
  estimated_probability: number;
  uncertainty: number;
  fair_odds: number;
  best_odds: number;
  best_bookmaker: string;
  expected_value: number;
  ev_percentage: number;
  data_quality: DataFreshness;
  factors: Factor[];
}

export interface Factor {
  type: 'favorable' | 'uncertainty' | 'limitation';
  label: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface Opportunity {
  id: string;
  game_id: string;
  game: Game;
  market: MarketType;
  line?: number;
  selection: SelectionType;
  bookmaker: string;
  odds: number;
  estimated_probability?: number;
  fair_odds?: number;
  expected_value: number;
  ev_percentage: number;
  data_completeness: number;
  factors: Factor[];
  collected_at: string;
  model_version: ModelVersion;
  qualified: boolean;
  qualification_reason?: string;
}

export interface HistoricalRecord {
  id: string;
  game_id: string;
  opportunity_id?: string;
  model_version: ModelVersion;
  market: MarketType;
  line?: number;
  selection: SelectionType;
  predicted_probability: number;
  fair_odds: number;
  best_odds: number;
  best_bookmaker: string;
  expected_value: number;
  data_completeness: number;
  collected_at: string;
  result?: 'win' | 'loss' | 'push' | 'cancelled';
  actual_outcome?: SelectionType;
  settled_at?: string;
  units: number;
  pnl: number;
}

export interface CreditUsage {
  date: string;
  endpoint: string;
  credits_used: number;
  remaining: number;
}

export interface AppSettings {
  min_ev_threshold: number;
  min_data_completeness: number;
  max_odds_age_hours: number;
  max_opportunities: number;
  demo_mode: boolean;
  enabled_leagues: League[];
  monthly_credit_limit: number;
  cron_enabled: boolean;
}

export interface DashboardData {
  last_update: string;
  next_update: string;
  games_today: Game[];
  opportunities: Opportunity[];
  credit_usage: CreditUsage;
  sources_status: SourceStatus[];
  demo_mode: boolean;
}

export interface SourceStatus {
  name: string;
  status: 'ok' | 'degraded' | 'down' | 'unconfigured';
  last_check: string;
  credits_remaining?: number;
  message?: string;
}

export interface CSVImportData {
  team_id: string;
  season: string;
  games_played: number;
  offensive_rating: number;
  defensive_rating: number;
  pace: number;
  efg_pct: number;
  tov_pct: number;
  orb_pct: number;
  ft_rate: number;
}
