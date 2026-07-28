ALTER TYPE "public"."job_status" ADD VALUE 'in_progress' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE 'completed' BEFORE 'cancelled';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "start_otp" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "end_otp" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "cancelled_by" text;