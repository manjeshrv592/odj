CREATE TYPE "public"."chat_message_type" AS ENUM('text', 'location');--> statement-breakpoint
CREATE TYPE "public"."chat_sender_role" AS ENUM('worker', 'hirer');--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"sender_role" "chat_sender_role" NOT NULL,
	"type" "chat_message_type" NOT NULL,
	"body" text,
	"lat" double precision,
	"lng" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_job_created_idx" ON "chat_messages" USING btree ("job_id","created_at");