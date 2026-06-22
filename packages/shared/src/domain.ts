import { z } from "zod";

/**
 * Core domain primitives for the ODJ hiring platform.
 *
 * This file is the **single source of truth** for cross-cutting domain types
 * (roles, approval state, categories, …). Backend validation, web forms, and
 * mobile forms all import from here so the same constraints apply everywhere.
 *
 * It is intentionally minimal for now; it grows as features are built. Where a
 * table is owned by the backend (Drizzle), prefer generating its zod schema via
 * `drizzle-zod` and re-exporting refined versions here.
 */

/**
 * Who a user is on the platform — their marketplace identity.
 *
 * - `worker` / `hirer` are mobile-app users.
 * - `admin` are web-portal users (invite-only).
 *
 * Stored on the better-auth `user` row as the `userType` additional field
 * (nullable until a mobile user picks "Work" or "Hire" during onboarding).
 */
export const userTypeSchema = z.enum(["worker", "hirer", "admin"]);
export type UserType = z.infer<typeof userTypeSchema>;

/** Back-compat alias for {@link userTypeSchema}. */
export const userRoleSchema = userTypeSchema;
export type UserRole = UserType;

/**
 * Admin sub-role for web-portal users (only meaningful when
 * `userType === "admin"`). `root` is the bootstrap super-admin seeded from
 * `ROOT_USER_EMAIL`; `admin` are invited operators. Both may manage portal users.
 */
export const adminRoleSchema = z.enum(["root", "admin"]);
export type AdminRole = z.infer<typeof adminRoleSchema>;

/** Admin approval lifecycle for worker/hirer profiles and submitted documents. */
export const approvalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

/**
 * A working domain/category an admin can define (e.g. "Driver", "Bouncer",
 * "Maid"). Placeholder shape to establish the pattern — extend with required
 * documents, pricing rules, etc. as those features land.
 */
export const categorySchema = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});
export type Category = z.infer<typeof categorySchema>;

/** Payload to create a category (server assigns `id`). */
export const createCategorySchema = categorySchema.omit({ id: true });
export type CreateCategory = z.infer<typeof createCategorySchema>;

/** Email used for OTP login. Normalised to lowercase. */
export const emailSchema = z
  .email()
  .transform((v) => v.toLowerCase().trim());

/** A 6-digit one-time passcode. */
export const otpSchema = z.string().regex(/^\d{6}$/, "OTP must be 6 digits");

/**
 * Contact phone number, stored as-is (no SMS/OTP verification yet — that lands
 * with DLT). Lenient: allows a leading `+`, digits, spaces, dashes, parentheses.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(20, "Phone number is too long")
  .regex(/^\+?[\d\s()-]+$/, "Enter a valid phone number");

// ── Identity / onboarding ────────────────────────────────────────────────────

/**
 * App-facing view of the authenticated user, projecting the better-auth `user`
 * row plus ODJ's additional fields. Clients read this off the session; the
 * `userType`/`adminRole`/`onboardingCompleted` fields drive routing and access.
 */
export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullish(),
  userType: userTypeSchema.nullish(),
  adminRole: adminRoleSchema.nullish(),
  onboardingCompleted: z.boolean().default(false),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  phone: z.string().nullish(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

// ── Admin profile (onboarding wizard + profile page) ─────────────────────────

/**
 * Partial update of an admin's own profile (name / phone / avatar). Used by the
 * Profile page; `name` is derived server-side as "first last". Email is NOT here
 * — it changes via the OTP flow (better-auth emailOTP `changeEmail`).
 */
export const adminProfileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  phone: phoneSchema.optional(),
  image: z.url().nullish(),
});
export type AdminProfileUpdate = z.infer<typeof adminProfileUpdateSchema>;

/**
 * Wizard finish payload: completes admin onboarding in one shot. First/last name
 * and phone are required; avatar is optional (the step is skippable). The server
 * derives `name` and flips `onboardingCompleted` to true.
 */
export const completeOnboardingSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  phone: phoneSchema,
  image: z.url().nullish(),
});
export type CompleteOnboarding = z.infer<typeof completeOnboardingSchema>;

// ── Admin portal users (invite-only) ─────────────────────────────────────────

/** Invite a new admin to the web portal. Email only — the rest is filled later. */
export const inviteAdminSchema = z.object({
  email: emailSchema,
});
export type InviteAdmin = z.infer<typeof inviteAdminSchema>;

/** A portal (admin) user as listed in the admin "Portal users" table. */
export const portalUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  adminRole: adminRoleSchema,
  onboardingCompleted: z.boolean(),
  emailVerified: z.boolean(),
  createdAt: z.coerce.date(),
});
export type PortalUser = z.infer<typeof portalUserSchema>;
