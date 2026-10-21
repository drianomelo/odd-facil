ALTER TABLE "player_prop_forecasts" ADD COLUMN "player_team" varchar(100);--> statement-breakpoint
ALTER TABLE "player_prop_ticket_legs" ADD COLUMN "commence_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "player_prop_ticket_legs" ADD COLUMN "opponent_team" varchar(100);--> statement-breakpoint
ALTER TABLE "player_prop_ticket_legs" ADD COLUMN "player_team" varchar(100);--> statement-breakpoint
ALTER TABLE "player_prop_ticket_legs" ADD COLUMN "actual_value" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "player_prop_ticket_legs" ADD COLUMN "result" varchar(20);--> statement-breakpoint
ALTER TABLE "player_prop_ticket_legs" ADD COLUMN "graded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "player_prop_tickets" ADD COLUMN "source" varchar(20) DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "player_prop_tickets" ADD COLUMN "stake_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "player_prop_tickets" ADD COLUMN "potential_return" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "player_prop_tickets" ADD COLUMN "actual_return" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "player_prop_tickets" ADD COLUMN "manual_outcome" varchar(20);