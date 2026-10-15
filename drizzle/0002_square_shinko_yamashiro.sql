CREATE TABLE IF NOT EXISTS "player_prop_ticket_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"forecast_id" uuid,
	"position" integer NOT NULL,
	"event_id" varchar(100) NOT NULL,
	"player_name" varchar(100) NOT NULL,
	"market" varchar(50) NOT NULL,
	"line" numeric(7, 1) NOT NULL,
	"selection" varchar(10) NOT NULL,
	"american_odds" integer NOT NULL,
	"bookmaker" varchar(100) NOT NULL,
	"bookmaker_key" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_prop_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(20) NOT NULL,
	"label" varchar(100) NOT NULL,
	"bookmaker" varchar(100) NOT NULL,
	"combined_decimal_odds" numeric(12, 4) NOT NULL,
	"combined_american_odds" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_prop_ticket_legs" ADD CONSTRAINT "player_prop_ticket_legs_ticket_id_player_prop_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."player_prop_tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_prop_ticket_legs" ADD CONSTRAINT "player_prop_ticket_legs_forecast_id_player_prop_forecasts_id_fk" FOREIGN KEY ("forecast_id") REFERENCES "public"."player_prop_forecasts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_prop_ticket_leg_position_idx" ON "player_prop_ticket_legs" ("ticket_id","position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_prop_ticket_leg_forecast_idx" ON "player_prop_ticket_legs" ("forecast_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_prop_ticket_created_idx" ON "player_prop_tickets" ("created_at");