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

/** Who a user is on the platform. */
export const userRoleSchema = z.enum(["worker", "hirer", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

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
