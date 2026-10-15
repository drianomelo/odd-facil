CREATE TABLE IF NOT EXISTS "credit_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"endpoint" varchar(100) NOT NULL,
	"credits_used" integer NOT NULL,
	"remaining" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(100) NOT NULL,
	"league_id" varchar(10) NOT NULL,
	"home_team_id" uuid NOT NULL,
	"away_team_id" uuid NOT NULL,
	"commence_time" timestamp with time zone NOT NULL,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "h2h_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"home_team_id" uuid NOT NULL,
	"away_team_id" uuid NOT NULL,
	"game_date" timestamp with time zone NOT NULL,
	"home_score" integer NOT NULL,
	"away_score" integer NOT NULL,
	"location" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "historical_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"model_version" varchar(50) NOT NULL,
	"market" varchar(20) NOT NULL,
	"line" numeric(4, 1),
	"selection" varchar(20) NOT NULL,
	"predicted_probability" numeric(6, 4) NOT NULL,
	"fair_odds" numeric(6, 3) NOT NULL,
	"best_odds" numeric(6, 3) NOT NULL,
	"best_bookmaker" varchar(100) NOT NULL,
	"expected_value" numeric(6, 4) NOT NULL,
	"data_completeness" numeric(4, 2) NOT NULL,
	"collected_at" timestamp with time zone NOT NULL,
	"result" varchar(20),
	"actual_outcome" varchar(20),
	"settled_at" timestamp with time zone,
	"units" numeric(4, 2) DEFAULT '1.00' NOT NULL,
	"pnl" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "injuries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_name" varchar(100) NOT NULL,
	"team_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"injury" text,
	"reported_at" timestamp with time zone NOT NULL,
	"source" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leagues" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "model_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"model_version" varchar(50) NOT NULL,
	"market" varchar(20) NOT NULL,
	"line" numeric(4, 1),
	"selection" varchar(20) NOT NULL,
	"estimated_probability" numeric(6, 4) NOT NULL,
	"uncertainty" numeric(6, 4) NOT NULL,
	"fair_odds" numeric(6, 3) NOT NULL,
	"best_odds" numeric(6, 3),
	"best_bookmaker" varchar(100),
	"expected_value" numeric(6, 4),
	"data_completeness" numeric(4, 2) NOT NULL,
	"factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "odds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"bookmaker_key" varchar(50) NOT NULL,
	"bookmaker_title" varchar(100) NOT NULL,
	"market" varchar(20) NOT NULL,
	"line" numeric(4, 1),
	"selection" varchar(20) NOT NULL,
	"odds" numeric(6, 3) NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bookmaker_last_update" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"prediction_id" uuid,
	"market" varchar(20) NOT NULL,
	"line" numeric(4, 1),
	"selection" varchar(20) NOT NULL,
	"bookmaker" varchar(100) NOT NULL,
	"odds" numeric(6, 3) NOT NULL,
	"estimated_probability" numeric(6, 4),
	"fair_odds" numeric(6, 3),
	"expected_value" numeric(6, 4) NOT NULL,
	"ev_percentage" numeric(6, 4) NOT NULL,
	"data_completeness" numeric(4, 2) NOT NULL,
	"factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"qualified" boolean DEFAULT false NOT NULL,
	"qualification_reason" text,
	"collected_at" timestamp with time zone NOT NULL,
	"model_version" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"key" varchar(50) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"season" varchar(10) NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"offensive_rating" numeric(6, 2),
	"defensive_rating" numeric(6, 2),
	"pace" numeric(6, 2),
	"efg_pct" numeric(5, 3),
	"tov_pct" numeric(5, 3),
	"orb_pct" numeric(5, 3),
	"ft_rate" numeric(5, 3),
	"opponent_adjusted" boolean DEFAULT false NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL,
	"source" varchar(50) DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(50) NOT NULL,
	"league_id" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"abbreviation" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "games" ADD CONSTRAINT "games_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "games" ADD CONSTRAINT "games_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "games" ADD CONSTRAINT "games_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "h2h_records" ADD CONSTRAINT "h2h_records_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "h2h_records" ADD CONSTRAINT "h2h_records_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "historical_records" ADD CONSTRAINT "historical_records_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "historical_records" ADD CONSTRAINT "historical_records_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "injuries" ADD CONSTRAINT "injuries_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "model_predictions" ADD CONSTRAINT "model_predictions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "odds" ADD CONSTRAINT "odds_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_prediction_id_model_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."model_predictions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_stats" ADD CONSTRAINT "team_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teams" ADD CONSTRAINT "teams_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_usage_date_idx" ON "credit_usage" ("date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "games_external_id_idx" ON "games" ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_commence_idx" ON "games" ("commence_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_league_idx" ON "games" ("league_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_status_idx" ON "games" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "h2h_teams_date_idx" ON "h2h_records" ("home_team_id","away_team_id","game_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "history_game_idx" ON "historical_records" ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "history_model_version_idx" ON "historical_records" ("model_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "history_result_idx" ON "historical_records" ("result");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "history_settled_idx" ON "historical_records" ("settled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "injuries_team_reported_idx" ON "injuries" ("team_id","reported_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "predictions_game_market_selection_idx" ON "model_predictions" ("game_id","market","selection");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "predictions_model_version_idx" ON "model_predictions" ("model_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "predictions_computed_idx" ON "model_predictions" ("computed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "odds_game_market_selection_idx" ON "odds" ("game_id","market","selection");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "odds_collected_idx" ON "odds" ("collected_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "odds_bookmaker_idx" ON "odds" ("bookmaker_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_game_idx" ON "opportunities" ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_qualified_idx" ON "opportunities" ("qualified");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_collected_idx" ON "opportunities" ("collected_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_stats_team_season_idx" ON "team_stats" ("team_id","season");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_stats_team_idx" ON "team_stats" ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "teams_external_id_league_idx" ON "teams" ("external_id","league_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teams_league_idx" ON "teams" ("league_id");