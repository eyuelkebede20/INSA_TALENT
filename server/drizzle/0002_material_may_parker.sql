CREATE TABLE "student_feedbacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "accessTokenExpiresAt" timestamp;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "refreshTokenExpiresAt" timestamp;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "scope" text;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "registration_open" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "player_daily_stats" ADD COLUMN "draws" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "lichess_wins" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "lichess_losses" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "lichess_draws" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "student_feedbacks" ADD CONSTRAINT "student_feedbacks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "players_team_id_idx" ON "players" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "players_tier_idx" ON "players" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "teams_is_locked_idx" ON "teams" USING btree ("is_locked");