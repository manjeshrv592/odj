CREATE TYPE "public"."rate_unit" AS ENUM('daily', 'hourly');--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "rate_unit" "rate_unit" DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "worker_rate_rupees" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "amount_paise" integer;