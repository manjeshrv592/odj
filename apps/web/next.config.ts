import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Load the monorepo-root `.env` into process.env so Next can inline the app's
// `NEXT_PUBLIC_*` vars at build time. The backend loads the same file via Node's
// `--env-file`; Next only auto-reads `.env` from the app dir, so we load the root
// one here explicitly (single source of env, no dotenv dependency).
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // No root .env (e.g. CI / production with real env vars) — ignore.
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  // @odj/shared is shipped as TypeScript source; Next must transpile it.
  transpilePackages: ["@odj/shared"],
};

export default nextConfig;
