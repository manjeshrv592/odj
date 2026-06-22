import { z } from "zod";

/**
 * Health-check contracts shared between the backend (which produces them) and
 * the web/mobile clients (which consume them). Keeping these in `@odj/shared`
 * means the response shape can never silently drift between server and clients.
 */

/** Coarse status used across health responses. */
export const healthStatusSchema = z.enum(["ok", "degraded", "error"]);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

/**
 * Liveness response (`GET /api/health`). Reports that the process is up.
 * Intentionally does NOT depend on the database — see `dbHealthSchema`.
 * `db` is a lightweight convenience summary, not a hard dependency.
 */
export const healthResponseSchema = z.object({
  status: healthStatusSchema,
  service: z.string(),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.string(), // ISO 8601
  db: z.enum(["connected", "disconnected", "unknown"]).default("unknown"),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * Readiness response (`GET /api/health/db`). Reflects whether the database is
 * actually reachable (runs `SELECT 1`). Served with HTTP 200 when connected,
 * 503 when not — so orchestrators can gate traffic on real dependency health.
 */
export const dbHealthSchema = z.object({
  status: healthStatusSchema,
  database: z.enum(["connected", "disconnected"]),
  latencyMs: z.number().nonnegative().nullable(),
  timestamp: z.string(),
  error: z.string().optional(),
});
export type DbHealth = z.infer<typeof dbHealthSchema>;
