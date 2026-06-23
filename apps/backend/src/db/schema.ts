import {
  pgTable,
  pgEnum,
  text,
  uuid,
  boolean,
  integer,
  jsonb,
  timestamp,
  doublePrecision,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import type {
  AllowedFileType,
  RequirementOption,
  RequirementAnswers,
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

// ── Worker / Hirer onboarding profiles (mobile) ──────────────────────────────
/**
 * Lifecycle of a worker/hirer profile: `draft` while the resumable onboarding
 * wizard is in progress, `under_review` after submit (awaiting admin approval —
 * later), `approved` / `rejected` are the admin-decision outcomes.
 */
export const profileStatus = pgEnum("profile_status", [
  "draft",
  "under_review",
  "approved",
  "rejected",
]);

/** Whether a hirer is an individual or a registered business. */
export const hirerType = pgEnum("hirer_type", ["individual", "business"]);

/** Legal organisation type for a business hirer. */
export const orgType = pgEnum("org_type", [
  "pvt_ltd",
  "llp",
  "partnership",
  "proprietorship",
  "other",
]);

/**
 * A worker's onboarding profile (one per user). Fixed columns for the known
 * fields; `answers` is a JSONB map keyed by each requirement field's stable
 * `key` (survives label edits). Chosen professions live in `worker_professions`.
 * `current_step` is the resumable wizard cursor; `status` drives mobile routing.
 */
export const workerProfiles = pgTable("worker_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  photoUrl: text("photo_url"),
  city: text("city"),
  state: text("state"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  languages: jsonb("languages").$type<string[]>().notNull().default([]),
  answers: jsonb("answers")
    .$type<RequirementAnswers>()
    .notNull()
    .default({}),
  status: profileStatus("status").notNull().default("draft"),
  currentStep: integer("current_step").notNull().default(0),
  submittedAt: timestamp("submitted_at"),
  rejectionReason: text("rejection_reason"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Worker ↔ profession join (a worker may have multiple skills). Kept relational
 * rather than JSON so future hiring-search can filter/join by profession.
 * Removing a profile or profession removes its rows.
 */
export const workerProfessions = pgTable(
  "worker_professions",
  {
    workerProfileId: uuid("worker_profile_id")
      .notNull()
      .references(() => workerProfiles.id, { onDelete: "cascade" }),
    professionId: uuid("profession_id")
      .notNull()
      .references(() => professions.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.workerProfileId, t.professionId] }),
    index("worker_professions_profession_idx").on(t.professionId),
  ],
);

/**
 * A hirer's onboarding profile (one per user). Individuals stop after the basics;
 * a business adds a legal name, optional org type, and an optional GSTIN (the
 * Individual/Business + GSTIN data later decides invoice type at payments time).
 */
export const hirerProfiles = pgTable("hirer_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  photoUrl: text("photo_url"),
  city: text("city"),
  state: text("state"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  hirerType: hirerType("hirer_type"),
  orgName: text("org_name"),
  orgType: orgType("org_type"),
  gstRegistered: boolean("gst_registered").notNull().default(false),
  gstin: text("gstin"),
  status: profileStatus("status").notNull().default("draft"),
  currentStep: integer("current_step").notNull().default(0),
  submittedAt: timestamp("submitted_at"),
  rejectionReason: text("rejection_reason"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Push tokens + in-app notifications ───────────────────────────────────────
/**
 * Expo push tokens registered per device. `token` is unique (a device's token is
 * stable); on re-register we re-point it at the current user. Removing a user
 * removes their tokens.
 */
export const pushTokens = pgTable(
  "push_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    platform: text("platform"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("push_tokens_user_idx").on(t.userId)],
);

/**
 * In-app notifications shown to a worker/hirer (verification decisions for now;
 * reusable later for chat/disputes/hiring). `data` is an optional payload (e.g.
 * a deep-link target). Removing a user removes their notifications.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);
