import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth";

/**
 * The mobile (worker/hirer) session attached to a request once `requireUser`
 * passes. `userType` may be null — a brand-new user hasn't picked Work/Hire yet,
 * and the role-selection route is reached before it is set.
 */
export interface AppUserContext {
  user: {
    id: string;
    email: string;
    name: string;
    userType: string | null;
    adminRole: string | null;
    emailVerified: boolean;
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      appUser?: AppUserContext["user"];
    }
  }
}

/**
 * Guard for the mobile app API (`/api/app/*`). Reads the better-auth session
 * (source of truth — no manual cookie parsing) and enforces:
 *
 * - no session     → 401 Unauthorized
 * - portal admin   → 403 (admins use the web portal, not the app API)
 * - any other user → attach `req.appUser` and continue (userType may be null)
 */
export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const u = session.user as AppUserContext["user"];
  if (u.adminRole) {
    res.status(403).json({ error: "App access is for workers and hirers" });
    return;
  }

  req.appUser = u;
  next();
}
