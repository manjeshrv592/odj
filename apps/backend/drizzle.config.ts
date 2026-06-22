import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit configuration (migrations + studio).
 * DATABASE_URL is injected by the `db:*` scripts via Node's `--env-file=../../.env`.
 */
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
