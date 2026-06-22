import Constants from "expo-constants";

const BACKEND_PORT = 4000;

/**
 * Resolve the backend base URL so it works across run targets:
 *
 * 1. `EXPO_PUBLIC_API_URL` (explicit override) always wins — set this for
 *    staging/prod or a custom host.
 * 2. On a real device / emulator in dev, `localhost` would point at the *device*,
 *    not the laptop. So we reuse the LAN host the device already used to reach
 *    Metro (e.g. `192.168.0.65:8081` → `http://192.168.0.65:4000`).
 * 3. Fallback to `localhost` (web / when no host is discoverable).
 */
function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    "";
  const host = hostUri.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:${BACKEND_PORT}`;
  }

  return `http://localhost:${BACKEND_PORT}`;
}

/** Base URL of the ODJ Express backend. */
export const API_URL = resolveApiUrl();

/** Thin typed fetch helper for the mobile app. */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}
