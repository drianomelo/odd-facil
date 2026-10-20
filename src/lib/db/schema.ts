import { pgTable, uuid, varchar, text, timestamp, integer, decimal, boolean, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const leagues = pgTable('leagues', {
  id: varchar('id', { length: 10 }).primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  enabled: boolean('enabled').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  external_id: varchar('external_id', { length: 50 }).notNull(),
  league_id: varchar('league_id', { length: 10 }).references(() => leagues.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  abbreviation: varchar('abbreviation', { length: 10 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  unique_external: uniqueIndex('teams_external_id_league_idx').on(table.external_id, table.league_id),
  league_idx: index('teams_league_idx').on(table.league_id),
}));

export const games = pgTable('games', {
  id: uuid('id').defaultRandom().primaryKey(),
  external_id: varchar('external_id', { length: 100 }).notNull(),
  league_id: varchar('league_id', { length: 10 }).references(() => leagues.id).notNull(),
  home_team_id: uuid('home_team_id').references(() => teams.id).notNull(),
  away_team_id: uuid('away_team_id').references(() => teams.id).notNull(),
  commence_time: timestamp('commence_time', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 20 }).default('scheduled').notNull(),
  home_score: integer('home_score'),
  away_score: integer('away_score'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  unique_external: uniqueIndex('games_external_id_idx').on(table.external_id),
  commence_idx: index('games_commence_idx').on(table.commence_time),
  league_idx: index('games_league_idx').on(table.league_id),
  status_idx: index('games_status_idx').on(table.status),
}));

export const odds = pgTable('odds', {
  id: uuid('id').defaultRandom().primaryKey(),
  game_id: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
  bookmaker_key: varchar('bookmaker_key', { length: 50 }).notNull(),
  bookmaker_title: varchar('bookmaker_title', { length: 100 }).notNull(),
  market: varchar('market', { length: 20 }).notNull(),
  line: decimal('line', { precision: 4, scale: 1 }),
  selection: varchar('selection', { length: 20 }).notNull(),
  odds: decimal('odds', { precision: 6, scale: 3 }).notNull(),
  collected_at: timestamp('collected_at', { withTimezone: true }).defaultNow().notNull(),
  bookmaker_last_update: timestamp('bookmaker_last_update', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  game_market_selection_idx: index('odds_game_market_selection_idx').on(table.game_id, table.market, table.selection),
  collected_idx: index('odds_collected_idx').on(table.collected_at),
  bookmaker_idx: index('odds_bookmaker_idx').on(table.bookmaker_key),
}));

export const teamStats = pgTable('team_stats', {
  id: uuid('id').defaultRandom().primaryKey(),
  team_id: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  season: varchar('season', { length: 10 }).notNull(),
  games_played: integer('games_played').default(0).notNull(),
  offensive_rating: decimal('offensive_rating', { precision: 6, scale: 2 }),
  defensive_rating: decimal('defensive_rating', { precision: 6, scale: 2 }),
  pace: decimal('pace', { precision: 6, scale: 2 }),
  efg_pct: decimal('efg_pct', { precision: 5, scale: 3 }),
  tov_pct: decimal('tov_pct', { precision: 5, scale: 3 }),
  orb_pct: decimal('orb_pct', { precision: 5, scale: 3 }),
  ft_rate: decimal('ft_rate', { precision: 5, scale: 3 }),
  opponent_adjusted: boolean('opponent_adjusted').default(false).notNull(),
  last_updated: timestamp('last_updated', { withTimezone: true }).defaultNow().notNull(),
  source: varchar('source', { length: 50 }).default('manual').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  unique_team_season: uniqueIndex('team_stats_team_season_idx').on(table.team_id, table.season),
  team_idx: index('team_stats_team_idx').on(table.team_id),
}));

export const injuries = pgTable('injuries', {
  id: uuid('id').defaultRandom().primaryKey(),
  player_name: varchar('player_name', { length: 100 }).notNull(),
  team_id: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  injury: text('injury'),
  reported_at: timestamp('reported_at', { withTimezone: true }).notNull(),
  source: varchar('source', { length: 100 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  team_reported_idx: index('injuries_team_reported_idx').on(table.team_id, table.reported_at),
}));

export const h2hRecords = pgTable('h2h_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  home_team_id: uuid('home_team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  away_team_id: uuid('away_team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  game_date: timestamp('game_date', { withTimezone: true }).notNull(),
  home_score: integer('home_score').notNull(),
  away_score: integer('away_score').notNull(),
  location: varchar('location', { length: 10 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  teams_date_idx: index('h2h_teams_date_idx').on(table.home_team_id, table.away_team_id, table.game_date),
}));

export const modelPredictions = pgTable('model_predictions', {
  id: uuid('id').defaultRandom().primaryKey(),
  game_id: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
  model_version: varchar('model_version', { length: 50 }).notNull(),
  market: varchar('market', { length: 20 }).notNull(),
  line: decimal('line', { precision: 4, scale: 1 }),
  selection: varchar('selection', { length: 20 }).notNull(),
  estimated_probability: decimal('estimated_probability', { precision: 6, scale: 4 }).notNull(),
  uncertainty: decimal('uncertainty', { precision: 6, scale: 4 }).notNull(),
  fair_odds: decimal('fair_odds', { precision: 6, scale: 3 }).notNull(),
  best_odds: decimal('best_odds', { precision: 6, scale: 3 }),
  best_bookmaker: varchar('best_bookmaker', { length: 100 }),
  expected_value: decimal('expected_value', { precision: 6, scale: 4 }),
  data_completeness: decimal('data_completeness', { precision: 4, scale: 2 }).notNull(),
  factors: jsonb('factors').$type<Factor[]>().default([]).notNull(),
  computed_at: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  game_market_selection_idx: index('predictions_game_market_selection_idx').on(table.game_id, table.market, table.selection),
  model_version_idx: index('predictions_model_version_idx').on(table.model_version),
  computed_idx: index('predictions_computed_idx').on(table.computed_at),
}));

export const opportunities = pgTable('opportunities', {
  id: uuid('id').defaultRandom().primaryKey(),
  game_id: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
  prediction_id: uuid('prediction_id').references(() => modelPredictions.id, { onDelete: 'set null' }),
  market: varchar('market', { length: 20 }).notNull(),
  line: decimal('line', { precision: 4, scale: 1 }),
  selection: varchar('selection', { length: 20 }).notNull(),
  bookmaker: varchar('bookmaker', { length: 100 }).notNull(),
  odds: decimal('odds', { precision: 6, scale: 3 }).notNull(),
  estimated_probability: decimal('estimated_probability', { precision: 6, scale: 4 }),
  fair_odds: decimal('fair_odds', { precision: 6, scale: 3 }),
  expected_value: decimal('expected_value', { precision: 6, scale: 4 }).notNull(),
  ev_percentage: decimal('ev_percentage', { precision: 6, scale: 4 }).notNull(),
  data_completeness: decimal('data_completeness', { precision: 4, scale: 2 }).notNull(),
  factors: jsonb('factors').$type<Factor[]>().default([]).notNull(),
  qualified: boolean('qualified').default(false).notNull(),
  qualification_reason: text('qualification_reason'),
  collected_at: timestamp('collected_at', { withTimezone: true }).notNull(),
  model_version: varchar('model_version', { length: 50 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  game_idx: index('opportunities_game_idx').on(table.game_id),
  qualified_idx: index('opportunities_qualified_idx').on(table.qualified),
  collected_idx: index('opportunities_collected_idx').on(table.collected_at),
}));

export const historicalRecords = pgTable('historical_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  game_id: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
  opportunity_id: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'set null' }),
  model_version: varchar('model_version', { length: 50 }).notNull(),
  market: varchar('market', { length: 20 }).notNull(),
  line: decimal('line', { precision: 4, scale: 1 }),
  selection: varchar('selection', { length: 20 }).notNull(),
  predicted_probability: decimal('predicted_probability', { precision: 6, scale: 4 }).notNull(),
  fair_odds: decimal('fair_odds', { precision: 6, scale: 3 }).notNull(),
  best_odds: decimal('best_odds', { precision: 6, scale: 3 }).notNull(),
  best_bookmaker: varchar('best_bookmaker', { length: 100 }).notNull(),
  expected_value: decimal('expected_value', { precision: 6, scale: 4 }).notNull(),
  data_completeness: decimal('data_completeness', { precision: 4, scale: 2 }).notNull(),
  collected_at: timestamp('collected_at', { withTimezone: true }).notNull(),
  result: varchar('result', { length: 20 }),
  actual_outcome: varchar('actual_outcome', { length: 20 }),
  settled_at: timestamp('settled_at', { withTimezone: true }),
  units: decimal('units', { precision: 4, scale: 2 }).default('1.00').notNull(),
  pnl: decimal('pnl', { precision: 8, scale: 2 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  game_idx: index('history_game_idx').on(table.game_id),
  model_version_idx: index('history_model_version_idx').on(table.model_version),
  result_idx: index('history_result_idx').on(table.result),
  settled_idx: index('history_settled_idx').on(table.settled_at),
}));

export const playerPropForecasts = pgTable('player_prop_forecasts', {
  id: uuid('id').defaultRandom().primaryKey(),
  event_id: varchar('event_id', { length: 100 }).notNull(),
  player_name: varchar('player_name', { length: 100 }).notNull(),
  player_team: varchar('player_team', { length: 100 }),
  market: varchar('market', { length: 50 }).notNull(),
  line: decimal('line', { precision: 7, scale: 1 }).notNull(),
  model_version: varchar('model_version', { length: 50 }).notNull(),
  selection: varchar('selection', { length: 10 }).notNull(),
  projection: decimal('projection', { precision: 8, scale: 2 }).notNull(),
  predicted_probability: decimal('predicted_probability', { precision: 6, scale: 4 }).notNull(),
  market_probability: decimal('market_probability', { precision: 6, scale: 4 }),
  american_odds: integer('american_odds'),
  bookmaker: varchar('bookmaker', { length: 100 }),
  expected_value: decimal('expected_value', { precision: 8, scale: 4 }),
  sample_size: integer('sample_size').notNull(),
  confidence: varchar('confidence', { length: 20 }).notNull(),
  shortlist_eligible: boolean('shortlist_eligible').default(false).notNull(),
  commence_time: timestamp('commence_time', { withTimezone: true }).notNull(),
  recorded_at: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  actual_value: decimal('actual_value', { precision: 8, scale: 2 }),
  result: varchar('result', { length: 20 }),
  graded_at: timestamp('graded_at', { withTimezone: true }),
  details: jsonb('details').$type<Record<string, unknown>>().default({}).notNull(),
}, (table) => ({
  unique_forecast: uniqueIndex('player_prop_forecast_identity_idx').on(
    table.event_id, table.player_name, table.market, table.line, table.model_version,
  ),
  event_idx: index('player_prop_forecast_event_idx').on(table.event_id),
  pending_idx: index('player_prop_forecast_pending_idx').on(table.result, table.commence_time),
  model_idx: index('player_prop_forecast_model_idx').on(table.model_version, table.recorded_at),
}));

export const playerPropTickets = pgTable('player_prop_tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: varchar('kind', { length: 20 }).notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  bookmaker: varchar('bookmaker', { length: 100 }).notNull(),
  combined_decimal_odds: decimal('combined_decimal_odds', { precision: 12, scale: 4 }),
  combined_american_odds: integer('combined_american_odds'),
  stake_amount: decimal('stake_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
  potential_return: decimal('potential_return', { precision: 12, scale: 2 }),
  actual_return: decimal('actual_return', { precision: 12, scale: 2 }),
  manual_outcome: varchar('manual_outcome', { length: 20 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  created_idx: index('player_prop_ticket_created_idx').on(table.created_at),
}));

export const playerPropTicketLegs = pgTable('player_prop_ticket_legs', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticket_id: uuid('ticket_id').references(() => playerPropTickets.id, { onDelete: 'cascade' }).notNull(),
  forecast_id: uuid('forecast_id').references(() => playerPropForecasts.id, { onDelete: 'set null' }),
  position: integer('position').notNull(),
  event_id: varchar('event_id', { length: 100 }).notNull(),
  player_name: varchar('player_name', { length: 100 }).notNull(),
  player_team: varchar('player_team', { length: 100 }),
  market: varchar('market', { length: 50 }).notNull(),
  line: decimal('line', { precision: 7, scale: 1 }).notNull(),
  selection: varchar('selection', { length: 10 }).notNull(),
  american_odds: integer('american_odds').notNull(),
  bookmaker: varchar('bookmaker', { length: 100 }).notNull(),
  bookmaker_key: varchar('bookmaker_key', { length: 100 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  ticket_position_idx: uniqueIndex('player_prop_ticket_leg_position_idx').on(table.ticket_id, table.position),
  forecast_idx: index('player_prop_ticket_leg_forecast_idx').on(table.forecast_id),
}));

export const creditUsage = pgTable('credit_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  date: timestamp('date', { withTimezone: true }).defaultNow().notNull(),
  endpoint: varchar('endpoint', { length: 100 }).notNull(),
  credits_used: integer('credits_used').notNull(),
  remaining: integer('remaining').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  date_idx: index('credit_usage_date_idx').on(table.date),
}));

export const settings = pgTable('settings', {
  key: varchar('key', { length: 50 }).primaryKey(),
  value: jsonb('value').notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Factor = {
  type: 'favorable' | 'uncertainty' | 'limitation';
  label: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
};
