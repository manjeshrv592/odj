import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit configuration (migrations + studio).
 *
 * Loads the monorepo-root `.env` so DATABASE_URL is available: drizzle-kit runs
 * as its own bin (resolved by pnpm — works under the hoisted node-linker), not
 * under `node --env-file`, so the config loads env itself. `loadEnvFile`
 * resolves relative to the cwd, which pnpm sets to this package dir. Wrapped in
 * try/catch so a missing root `.env` (CI / real env vars) is a no-op.
 */
try {
  process.loadEnvFile("../../.env");
} catch {
  // No root .env — rely on the already-present process.env (e.g. CI).
}
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
