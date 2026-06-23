CREATE TYPE "public"."hirer_type" AS ENUM('individual', 'business');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('pvt_ltd', 'llp', 'partnership', 'proprietorship', 'other');--> statement-breakpoint
CREATE TYPE "public"."profile_status" AS ENUM('draft', 'under_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "hirer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"photo_url" text,
	"city" text,
	"state" text,
	"lat" double precision,
	"lng" double precision,
	"hirer_type" "hirer_type",
	"org_name" text,
	"org_type" "org_type",
	"gst_registered" boolean DEFAULT false NOT NULL,
	"gstin" text,
	"status" "profile_status" DEFAULT 'draft' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hirer_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "worker_professions" (
	"worker_profile_id" uuid NOT NULL,
	"profession_id" uuid NOT NULL,
	CONSTRAINT "worker_professions_worker_profile_id_profession_id_pk" PRIMARY KEY("worker_profile_id","profession_id")
);
--> statement-breakpoint
CREATE TABLE "worker_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"photo_url" text,
	"city" text,
	"state" text,
	"lat" double precision,
	"lng" double precision,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "profile_status" DEFAULT 'draft' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "worker_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "hirer_profiles" ADD CONSTRAINT "hirer_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_professions" ADD CONSTRAINT "worker_professions_worker_profile_id_worker_profiles_id_fk" FOREIGN KEY ("worker_profile_id") REFERENCES "public"."worker_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_professions" ADD CONSTRAINT "worker_professions_profession_id_professions_id_fk" FOREIGN KEY ("profession_id") REFERENCES "public"."professions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD CONSTRAINT "worker_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "worker_professions_profession_idx" ON "worker_professions" USING btree ("profession_id");