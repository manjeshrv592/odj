import {
  pgTable,
  pgEnum,
  text,
  uuid,
  boolean,
  integer,
  jsonb,
  timestamp,
  date,
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
 *
 * Admin price bounds (INR whole rupees) constrain what a worker may charge for
 * this profession. A unit (daily / hourly) is "supported" only when **both** its
 * min and max are set; otherwise workers can't set a rate for it.
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
    dailyMin: integer("daily_min"),
    dailyMax: integer("daily_max"),
    hourlyMin: integer("hourly_min"),
    hourlyMax: integer("hourly_max"),
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
  // Precise current location (Phase 3 — high-accuracy foreground capture). `lat`/
  // `lng` are reused (overwritten with high-accuracy values); `locationAccuracy`
  // is the reported radius in metres and `locationCapturedAt` its freshness.
  locationAccuracy: doublePrecision("location_accuracy"),
  locationCapturedAt: timestamp("location_captured_at"),
  // Post-approval setup progress: `availabilityReviewedAt` is set when the worker
  // opens the (optional) day-off calendar; `setupCompletedAt` is set when they
  // finish or skip the dashboard setup flow (drives routing to the worker home).
  availabilityReviewedAt: timestamp("availability_reviewed_at"),
  setupCompletedAt: timestamp("setup_completed_at"),
  // Uber-style presence: a worker only receives job offers while `is_online`.
  isOnline: boolean("is_online").notNull().default(false),
  lastOnlineAt: timestamp("last_online_at"),
  // Denormalized rating aggregate (§8), kept in sync transactionally whenever a
  // hirer rates this worker for a completed job — see `ratings` below.
  avgRating: doublePrecision("avg_rating"),
  ratingCount: integer("rating_count").notNull().default(0),
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
 * What an (approved) worker charges per profession (INR whole rupees). One row
 * per (worker, profession); a unit is set only if the profession's admin bounds
 * enable it and the value is within `[min, max]` (enforced server-side). Either
 * rate may be null when the worker hasn't set that unit yet.
 */
export const workerProfessionRates = pgTable(
  "worker_profession_rates",
  {
    workerProfileId: uuid("worker_profile_id")
      .notNull()
      .references(() => workerProfiles.id, { onDelete: "cascade" }),
    professionId: uuid("profession_id")
      .notNull()
      .references(() => professions.id, { onDelete: "cascade" }),
    dailyRate: integer("daily_rate"),
    hourlyRate: integer("hourly_rate"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.workerProfileId, t.professionId] }),
    index("worker_profession_rates_profession_idx").on(t.professionId),
  ],
);

/**
 * Days an (approved) worker is **not** working (Phase 2). One row per day off;
 * `profession_id` null ⇒ off for **all** professions that day, else off only for
 * that profession. Default (no row) = available. `date` is a calendar day
 * (`YYYY-MM-DD`, string mode). Dedup of `(worker, profession, date)` is handled
 * in the toggle endpoint (Postgres treats NULL as distinct).
 */
export const workerDaysOff = pgTable(
  "worker_days_off",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerProfileId: uuid("worker_profile_id")
      .notNull()
      .references(() => workerProfiles.id, { onDelete: "cascade" }),
    professionId: uuid("profession_id").references(() => professions.id, {
      onDelete: "cascade",
    }),
    date: date("date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("worker_days_off_worker_date_idx").on(t.workerProfileId, t.date)],
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
  // Denormalized rating aggregate (§8), kept in sync transactionally whenever a
  // worker rates this hirer for a completed job — see `ratings` below.
  avgRating: doublePrecision("avg_rating"),
  ratingCount: integer("rating_count").notNull().default(0),
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

// ── Hiring / matching (jobs + offers) ────────────────────────────────────────
/**
 * A hirer's search for a worker: `searching` while offers are out, `matched` once
 * a worker accepts (first-accept-wins), `cancelled` if the hirer stops, `expired`
 * if no one accepts in time, `no_workers` if none were eligible at search time.
 */
export const jobStatus = pgEnum("job_status", [
  "searching",
  "matched",
  "in_progress",
  "completed",
  "cancelled",
  "expired",
  "no_workers",
]);

/** Which of the worker's two rates prices a job (§5). */
export const rateUnit = pgEnum("rate_unit", ["daily", "hourly"]);

/** Lifecycle of a single job offer sent to one worker. */
export const offerStatus = pgEnum("offer_status", [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "expired",
]);

/**
 * A hiring search created by a hirer for one profession, centered on the hirer's
 * `lat`/`lng` with a `radius_km`. `matched_worker_profile_id` is the winner once a
 * worker accepts. `expires_at` bounds how long the search stays open.
 */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hirerProfileId: uuid("hirer_profile_id")
      .notNull()
      .references(() => hirerProfiles.id, { onDelete: "cascade" }),
    professionId: uuid("profession_id")
      .notNull()
      .references(() => professions.id, { onDelete: "cascade" }),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    radiusKm: integer("radius_km").notNull(),
    status: jobStatus("status").notNull().default("searching"),
    matchedWorkerProfileId: uuid("matched_worker_profile_id").references(
      () => workerProfiles.id,
      { onDelete: "set null" },
    ),
    // OTP handshake: hirer shows, worker enters — start moves to in_progress,
    // end moves to completed. Generated when the job is matched. The hirer's start
    // code stays hidden until the worker taps "Start work" (`startRequestedAt`).
    startOtp: text("start_otp"),
    endOtp: text("end_otp"),
    startRequestedAt: timestamp("start_requested_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    cancelledBy: text("cancelled_by"), // 'hirer' | 'worker'
    // ── Pricing (§5) ────────────────────────────────────────────────────────
    // The hirer fixes the *shape* of the price at booking (`rate_unit` +
    // `quantity`); the amount is only knowable once a worker accepts, because
    // every worker sets their own rate. `worker_rate_rupees` + `amount_paise`
    // are **snapshots** taken in the accept transaction — a later rate change
    // must never alter what an already-agreed job costs. Null on jobs that
    // never matched (searching / no_workers / expired).
    rateUnit: rateUnit("rate_unit").notNull().default("daily"),
    quantity: integer("quantity").notNull().default(1),
    workerRateRupees: integer("worker_rate_rupees"),
    amountPaise: integer("amount_paise"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("jobs_status_idx").on(t.status)],
);

/**
 * A job broadcast to one candidate worker. Exactly one offer per (job, worker).
 * On the winning accept, that offer → `accepted` and the rest → `cancelled`.
 */
export const jobOffers = pgTable(
  "job_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    workerProfileId: uuid("worker_profile_id")
      .notNull()
      .references(() => workerProfiles.id, { onDelete: "cascade" }),
    status: offerStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    respondedAt: timestamp("responded_at"),
  },
  (t) => [
    uniqueIndex("job_offers_job_worker_uniq").on(t.jobId, t.workerProfileId),
    index("job_offers_worker_status_idx").on(t.workerProfileId, t.status),
  ],
);

// ── Ratings (§8) ──────────────────────────────────────────────────────────────
/** Which party is rating whom for a job — resolved from the job's own FKs. */
export const ratingDirection = pgEnum("rating_direction", [
  "worker_to_hirer",
  "hirer_to_worker",
]);

/**
 * A single star (+ optional comment) rating, one per (job, direction) — at most
 * two rows per completed job (worker→hirer and hirer→worker). Eligibility is
 * job-history-based (job must be `completed`), not gated on current profile
 * approval status. Submitting a rating also updates the ratee's denormalized
 * `avgRating`/`ratingCount` on `workerProfiles`/`hirerProfiles` in the same
 * transaction.
 */
export const ratings = pgTable(
  "ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    direction: ratingDirection("direction").notNull(),
    stars: integer("stars").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ratings_job_direction_uniq").on(t.jobId, t.direction),
    index("ratings_job_idx").on(t.jobId),
  ],
);

// ── Chat (§7) ─────────────────────────────────────────────────────────────────
/** Which party sent a chat message — resolved from the job's own FKs, never client-supplied. */
export const chatSenderRole = pgEnum("chat_sender_role", ["worker", "hirer"]);

/** A chat message is either free text or a one-off shared location. */
export const chatMessageType = pgEnum("chat_message_type", ["text", "location"]);

/**
 * Worker↔hirer chat, scoped to one job. Live (via WebSocket) only while the
 * job is `matched`/`in_progress`; read-only after `completed`/`cancelled`.
 * `body` is set for `type: "text"`, `lat`/`lng` for `type: "location"`.
 */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    senderRole: chatSenderRole("sender_role").notNull(),
    type: chatMessageType("type").notNull(),
    body: text("body"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("chat_messages_job_created_idx").on(t.jobId, t.createdAt)],
);
