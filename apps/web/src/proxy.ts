import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Next.js 16 proxy (the renamed `middleware`). Optimistic, cookie-only auth
 * redirect for UX — it never hits the DB. Authoritative checks live in the
 * protected layout/pages via `getServerSessionUser` (auth-server.ts).
 *
 * The better-auth session cookie is set by the Express backend on host
 * `localhost`; cookies are host-scoped (not port-scoped), so the web app sees it.
 *
 * - signed-out + private route  → /login
 * - signed-in  + /login         → / (dashboard)
 */
const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasSession && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
