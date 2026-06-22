import { cookies } from "next/headers";
import { API_URL } from "./api";
import { sessionUserSchema, type SessionUser } from "@odj/shared";

/**
 * Read the current better-auth session on the server (RSC / route handlers).
 *
 * The auth server is the separate Express backend, so we forward the incoming
 * cookies to its `/api/auth/get-session` endpoint. Returns the projected
 * {@link SessionUser} or `null` when unauthenticated. This is the **authoritative**
 * check — `proxy.ts` only does an optimistic cookie-presence redirect for UX.
 */
export async function getServerSessionUser(): Promise<SessionUser | null> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;

  try {
    const res = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: unknown } | null;
    if (!data?.user) return null;
    const parsed = sessionUserSchema.safeParse(data.user);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** True when the session user is a portal admin (admin or root). */
export function isAdmin(user: SessionUser | null): boolean {
  return user?.adminRole === "admin" || user?.adminRole === "root";
}
