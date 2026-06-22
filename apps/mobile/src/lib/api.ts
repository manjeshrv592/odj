/** Base URL of the ODJ Express backend (Expo-public env var). */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

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
