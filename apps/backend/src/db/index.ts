import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env";
import * as schema from "./schema";

/**
 * Shared PostgreSQL connection pool. A single pool is reused across the process
 * (better-auth, request handlers, health checks) so connections are bounded.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

/** Drizzle ORM client bound to the pool and the full table schema. */
export const db = drizzle(pool, { schema });

export type DB = typeof db;
export { schema };
