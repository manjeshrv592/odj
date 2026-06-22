import { pgTable, text, uuid, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Full database schema = better-auth tables + ODJ domain tables.
 * `drizzle.config.ts` and the Drizzle client both point here.
 */

// ── Auth tables (better-auth) ────────────────────────────────────────────────
export * from "./auth-schema";

// ── Domain tables ────────────────────────────────────────────────────────────
/**
 * Working domains/categories an admin defines (Driver, Bouncer, Maid, …).
 * Starter table to establish the Drizzle → drizzle-zod pattern; extend with
 * required-documents, pricing, etc. as features land.
 */
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
