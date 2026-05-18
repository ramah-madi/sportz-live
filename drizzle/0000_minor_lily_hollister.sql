CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'live', 'finished');--> statement-breakpoint
CREATE TABLE "commentary" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"minute" integer NOT NULL,
	"sequence" integer NOT NULL,
	"period" varchar(50) NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"actor" varchar(150),
	"team" varchar(100),
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"sport" varchar(50) NOT NULL,
	"home_team" varchar(100) NOT NULL,
	"away_team" varchar(100) NOT NULL,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"home_score" integer DEFAULT 0 NOT NULL,
	"away_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commentary" ADD CONSTRAINT "commentary_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_commentary_match_timeline" ON "commentary" USING btree ("match_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_matches_sport_status" ON "matches" USING btree ("sport","status");--> statement-breakpoint
CREATE INDEX "idx_matches_start_time" ON "matches" USING btree ("start_time");