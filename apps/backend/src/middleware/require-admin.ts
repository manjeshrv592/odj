import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth";

/**
 * The portal session attached to a request once `requireAdmin` passes. Narrowed
 * to the fields routes actually use (identity + admin role).
 */
export interface AdminContext {
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
      admin?: AdminContext;
    }
  }
}

const ADMIN_ROLES = new Set(["root", "admin"]);

/**
 * Guard for admin-only API routes. Reads the better-auth session from the
 * request (no manual cookie parsing — `auth.api.getSession` is the source of
 * truth), then enforces the ODJ identity model:
 *
 * - no session            → 401 Unauthorized
 * - session, not an admin → 403 Forbidden
 * - admin / root          → attach `req.admin` and continue
 */
export async function requireAdmin(
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

  const u = session.user as AdminContext["user"];
  if (!u.adminRole || !ADMIN_ROLES.has(u.adminRole)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  req.admin = { user: u };
  next();
}
