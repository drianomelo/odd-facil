CREATE TABLE IF NOT EXISTS "player_prop_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar(100) NOT NULL,
	"player_name" varchar(100) NOT NULL,
	"market" varchar(50) NOT NULL,
	"line" numeric(7, 1) NOT NULL,
	"model_version" varchar(50) NOT NULL,
	"selection" varchar(10) NOT NULL,
	"projection" numeric(8, 2) NOT NULL,
	"predicted_probability" numeric(6, 4) NOT NULL,
	"market_probability" numeric(6, 4),
	"american_odds" integer,
	"bookmaker" varchar(100),
	"expected_value" numeric(8, 4),
	"sample_size" integer NOT NULL,
	"confidence" varchar(20) NOT NULL,
	"shortlist_eligible" boolean DEFAULT false NOT NULL,
	"commence_time" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actual_value" numeric(8, 2),
	"result" varchar(20),
	"graded_at" timestamp with time zone,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_prop_forecast_identity_idx" ON "player_prop_forecasts" ("event_id","player_name","market","line","model_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_prop_forecast_event_idx" ON "player_prop_forecasts" ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_prop_forecast_pending_idx" ON "player_prop_forecasts" ("result","commence_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_prop_forecast_model_idx" ON "player_prop_forecasts" ("model_version","recorded_at");