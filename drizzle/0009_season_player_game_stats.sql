CREATE TABLE IF NOT EXISTS "player_game_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season" varchar(10) NOT NULL,
	"event_id" varchar(100) NOT NULL,
	"game_date" timestamp with time zone NOT NULL,
	"player_id" varchar(100) NOT NULL,
	"player_name" varchar(100) NOT NULL,
	"team" varchar(100) NOT NULL,
	"opponent" varchar(100) NOT NULL,
	"minutes" numeric(6, 2) DEFAULT '0' NOT NULL,
	"played" boolean DEFAULT false NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"rebounds" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"threes" integer DEFAULT 0 NOT NULL,
	"source" varchar(50) DEFAULT 'espn-public' NOT NULL,
	"source_url" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_game_stats_event_player_idx" ON "player_game_stats" ("event_id","player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_game_stats_season_player_idx" ON "player_game_stats" ("season","player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_game_stats_game_date_idx" ON "player_game_stats" ("game_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_game_stats_team_season_idx" ON "player_game_stats" ("season","team");