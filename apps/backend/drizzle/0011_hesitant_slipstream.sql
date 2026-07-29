CREATE TYPE "public"."rating_direction" AS ENUM('worker_to_hirer', 'hirer_to_worker');--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"direction" "rating_direction" NOT NULL,
	"stars" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hirer_profiles" ADD COLUMN "avg_rating" double precision;--> statement-breakpoint
ALTER TABLE "hirer_profiles" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD COLUMN "avg_rating" double precision;--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ratings_job_direction_uniq" ON "ratings" USING btree ("job_id","direction");--> statement-breakpoint
CREATE INDEX "ratings_job_idx" ON "ratings" USING btree ("job_id");