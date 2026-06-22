import { parseBackendEnv } from "@odj/shared";

/**
 * Validated, typed backend configuration. Parsed once at import time so the
 * process crashes immediately (with a readable message) if anything is missing.
 */
export const env = parseBackendEnv(process.env);
