CREATE TYPE "public"."tier" AS ENUM('ADVANCED', 'MID', 'BEGINNER');--> statement-breakpoint
CREATE TABLE "event_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"advanced_threshold" integer DEFAULT 1200 NOT NULL,
	"mid_threshold" integer DEFAULT 600 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_daily_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"real_name" varchar(100) NOT NULL,
	"lichess_username" varchar(100),
	"chesscom_username" varchar(100),
	"insa_code" varchar(50),
	"current_rating" integer NOT NULL,
	"tier" "tier" NOT NULL,
	"team_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "players_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "players_email_unique" UNIQUE("email"),
	CONSTRAINT "players_lichess_username_unique" UNIQUE("lichess_username"),
	CONSTRAINT "players_chesscom_username_unique" UNIQUE("chesscom_username"),
	CONSTRAINT "players_insa_code_unique" UNIQUE("insa_code")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_number" integer NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teams_team_number_unique" UNIQUE("team_number")
);
--> statement-breakpoint
ALTER TABLE "player_daily_stats" ADD CONSTRAINT "player_daily_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;