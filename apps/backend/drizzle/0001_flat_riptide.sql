ALTER TABLE "user" ADD COLUMN "user_type" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "admin_role" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;