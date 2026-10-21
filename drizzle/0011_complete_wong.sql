CREATE TABLE IF NOT EXISTS "season_player_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season" varchar(10) NOT NULL,
	"event_id" varchar(100) NOT NULL,
	"player_id" varchar(100) NOT NULL,
	"player_name" varchar(100) NOT NULL,
	"player_team" varchar(100) NOT NULL,
	"opponent_team" varchar(100) NOT NULL,
	"game" text NOT NULL,
	"market" varchar(50) NOT NULL,
	"line" numeric(7, 1) NOT NULL,
	"selection" varchar(10) NOT NULL,
	"projection" numeric(8, 2) NOT NULL,
	"sample_size" integer NOT NULL,
	"observed_hits" integer NOT NULL,
	"observed_rate" numeric(6, 4) NOT NULL,
	"model_version" varchar(50) NOT NULL,
	"commence_time" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actual_value" numeric(8, 2),
	"result" varchar(20),
	"graded_at" timestamp with time zone,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "season_player_pick_identity_idx" ON "season_player_picks" ("event_id","player_id","market","model_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "season_player_pick_pending_idx" ON "season_player_picks" ("result","commence_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "season_player_pick_season_player_idx" ON "season_player_picks" ("season","player_id");