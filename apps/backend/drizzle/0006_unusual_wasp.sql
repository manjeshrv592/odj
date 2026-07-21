CREATE TABLE "worker_days_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_profile_id" uuid NOT NULL,
	"profession_id" uuid,
	"date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_profession_rates" (
	"worker_profile_id" uuid NOT NULL,
	"profession_id" uuid NOT NULL,
	"daily_rate" integer,
	"hourly_rate" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "worker_profession_rates_worker_profile_id_profession_id_pk" PRIMARY KEY("worker_profile_id","profession_id")
);
--> statement-breakpoint
ALTER TABLE "professions" ADD COLUMN "daily_min" integer;--> statement-breakpoint
ALTER TABLE "professions" ADD COLUMN "daily_max" integer;--> statement-breakpoint
ALTER TABLE "professions" ADD COLUMN "hourly_min" integer;--> statement-breakpoint
ALTER TABLE "professions" ADD COLUMN "hourly_max" integer;--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD COLUMN "location_accuracy" double precision;--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD COLUMN "location_captured_at" timestamp;--> statement-breakpoint
ALTER TABLE "worker_days_off" ADD CONSTRAINT "worker_days_off_worker_profile_id_worker_profiles_id_fk" FOREIGN KEY ("worker_profile_id") REFERENCES "public"."worker_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_days_off" ADD CONSTRAINT "worker_days_off_profession_id_professions_id_fk" FOREIGN KEY ("profession_id") REFERENCES "public"."professions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_profession_rates" ADD CONSTRAINT "worker_profession_rates_worker_profile_id_worker_profiles_id_fk" FOREIGN KEY ("worker_profile_id") REFERENCES "public"."worker_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_profession_rates" ADD CONSTRAINT "worker_profession_rates_profession_id_professions_id_fk" FOREIGN KEY ("profession_id") REFERENCES "public"."professions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "worker_days_off_worker_date_idx" ON "worker_days_off" USING btree ("worker_profile_id","date");--> statement-breakpoint
CREATE INDEX "worker_profession_rates_profession_idx" ON "worker_profession_rates" USING btree ("profession_id");