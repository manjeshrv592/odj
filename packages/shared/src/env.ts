import { z } from "zod";

/**
 * Shared environment-variable schemas.
 *
 * Each app validates `process.env` against the slice it needs at startup, so a
 * misconfigured deployment fails fast with a clear message instead of throwing
 * deep inside request handling. These schemas are the single source of truth
 * for what configuration each runtime expects.
 */

/** Variables required by the Express backend (the auth + API server). */
export const backendEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.url(),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
  MOBILE_SCHEME: z.string().default("odj"),
});

export type BackendEnv = z.infer<typeof backendEnvSchema>;

/**
 * Parse and validate backend env. Throws a readable error listing every
 * missing/invalid variable. Call once at process startup, passing `process.env`.
 * (Kept Node-type-free so this package stays runtime-agnostic for web/mobile.)
 */
export function parseBackendEnv(
  env: Record<string, string | undefined>,
): BackendEnv {
  const result = backendEnvSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid backend environment variables:\n${issues}`);
  }
  return result.data;
}
