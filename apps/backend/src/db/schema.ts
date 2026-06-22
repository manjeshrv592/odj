import {
  pgTable,
  pgEnum,
  text,
  uuid,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  AllowedFileType,
  RequirementOption,
} from "@odj/shared";

/**
 * Full database schema = better-auth tables + ODJ domain tables.
 * `drizzle.config.ts` and the Drizzle client both point here.
 */

// ── Auth tables (better-auth) ────────────────────────────────────────────────
export * from "./auth-schema";

// ── Catalog → Categories → Professions ───────────────────────────────────────
/**
 * Working domains/categories an admin defines (Driver, Bouncer, Maid, …). A
 * Category is a group of Professions and carries an icon image (Uploadcare CDN
 * url). `slug` is auto-generated from `name`; `is_active` hides without deleting.
 */
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  image: text("image"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * A Profession belongs to exactly one Category (Cab Driver → Driver). Name +
 * auto slug only. `slug` is unique per category; `position` orders within it.
 * Deleting a category cascades to its professions.
 */
export const professions = pgTable(
  "professions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("professions_category_slug_uniq").on(t.categoryId, t.slug),
    index("professions_category_idx").on(t.categoryId),
  ],
);

// ── Requirement fields (cascading worker questions) ──────────────────────────
/** Level a requirement field attaches to; drives the cascade onto a profession. */
export const requirementLevel = pgEnum("requirement_level", [
  "catalog",
  "category",
  "profession",
]);

/** Input type a worker uses to answer a requirement field. */
export const requirementInputType = pgEnum("requirement_input_type", [
  "text",
  "file",
  "select",
]);

/**
 * Admin-authored questions/documents collected from workers. One table for all
 * three levels: `category_id` set ⇒ category level, `profession_id` set ⇒
 * profession level, both null ⇒ catalog level (asked of all workers). Both FKs
 * cascade on delete so removing a category/profession removes its fields.
 *
 * `key` is a stable, immutable identifier (generated once from the label) that
 * future worker answers map to. `options` is used only for `select`,
 * `allowed_file_types` only for `file`.
 */
export const requirementFields = pgTable(
  "requirement_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    level: requirementLevel("level").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "cascade",
    }),
    professionId: uuid("profession_id").references(() => professions.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    inputType: requirementInputType("input_type").notNull(),
    required: boolean("required").notNull().default(false),
    options: jsonb("options").$type<RequirementOption[]>(),
    allowedFileTypes: jsonb("allowed_file_types").$type<AllowedFileType[]>(),
    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("requirement_fields_category_idx").on(t.categoryId),
    index("requirement_fields_profession_idx").on(t.professionId),
  ],
);
