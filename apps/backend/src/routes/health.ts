import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { HealthResponse, DbHealth } from "@odj/shared";

const SERVICE_NAME = "odj-backend";
const VERSION = process.env.npm_package_version ?? "0.0.1";

/**
 * Run a trivial `SELECT 1` to confirm the database is reachable, measuring
 * round-trip latency. Returns null latency on failure.
 */
async function checkDb(): Promise<{ ok: boolean; latencyMs: number | null; error?: string }> {
  const start = performance.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    return { ok: false, latencyMs: null, error: (err as Error).message };
  }
}

export const healthRouter: Router = Router();

/**
 * GET /api/health — LIVENESS.
 * Confirms the process is up. Does not hard-depend on the DB so an orchestrator
 * won't kill a healthy process during a transient DB blip. Includes a
 * best-effort `db` summary for convenience.
 */
healthRouter.get("/", async (_req: Request, res: Response) => {
  const dbCheck = await checkDb();
  const body: HealthResponse = {
    status: "ok",
    service: SERVICE_NAME,
    version: VERSION,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    db: dbCheck.ok ? "connected" : "disconnected",
  };
  res.status(200).json(body);
});

/**
 * GET /api/health/db — READINESS.
 * Reflects real database reachability. 200 when connected, 503 when not, so
 * load balancers / orchestrators can gate traffic on dependency health.
 */
healthRouter.get("/db", async (_req: Request, res: Response) => {
  const dbCheck = await checkDb();
  const body: DbHealth = {
    status: dbCheck.ok ? "ok" : "error",
    database: dbCheck.ok ? "connected" : "disconnected",
    latencyMs: dbCheck.latencyMs,
    timestamp: new Date().toISOString(),
    ...(dbCheck.error ? { error: dbCheck.error } : {}),
  };
  res.status(dbCheck.ok ? 200 : 503).json(body);
});
