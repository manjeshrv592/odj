CREATE TYPE "public"."requirement_input_type" AS ENUM('text', 'file', 'select');--> statement-breakpoint
CREATE TYPE "public"."requirement_level" AS ENUM('catalog', 'category', 'profession');--> statement-breakpoint
CREATE TABLE "professions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirement_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" "requirement_level" NOT NULL,
	"category_id" uuid,
	"profession_id" uuid,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"input_type" "requirement_input_type" NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"options" jsonb,
	"allowed_file_types" jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "professions" ADD CONSTRAINT "professions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_fields" ADD CONSTRAINT "requirement_fields_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_fields" ADD CONSTRAINT "requirement_fields_profession_id_professions_id_fk" FOREIGN KEY ("profession_id") REFERENCES "public"."professions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "professions_category_slug_uniq" ON "professions" USING btree ("category_id","slug");--> statement-breakpoint
CREATE INDEX "professions_category_idx" ON "professions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "requirement_fields_category_idx" ON "requirement_fields" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "requirement_fields_profession_idx" ON "requirement_fields" USING btree ("profession_id");