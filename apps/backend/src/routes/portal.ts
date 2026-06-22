import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { asc, eq } from "drizzle-orm";
import {
  adminProfileUpdateSchema,
  completeOnboardingSchema,
  inviteAdminSchema,
  type PortalUser,
} from "@odj/shared";
import { db } from "../db";
import { user } from "../db/schema";
import { env } from "../env";
import { requireAdmin } from "../middleware/require-admin";
import { sendAdminInviteEmail } from "../lib/email";

/**
 * Admin "Portal users" API. Every route is admin-only (`requireAdmin`). Portal
 * users are the web-portal administrators (`userType = "admin"`); workers/hirers
 * are never returned here. Both `root` and `admin` may invite/manage, but the
 * `root` user can never be deleted.
 */
export const portalRouter: Router = Router();

portalRouter.use(requireAdmin);

/** Project a user row to the public PortalUser shape. */
function toPortalUser(row: typeof user.$inferSelect): PortalUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    adminRole: (row.adminRole ?? "admin") as PortalUser["adminRole"],
    onboardingCompleted: row.onboardingCompleted,
    emailVerified: row.emailVerified,
    createdAt: row.createdAt,
  };
}

/** Derive the display `name` from first/last, falling back to the existing one. */
function deriveName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback: string,
): string {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  return full || fallback;
}

// PATCH /api/portal/me — update the signed-in admin's own profile (no OTP).
// Name/phone/avatar only; `name` is kept in sync as "first last". Email changes
// go through the better-auth emailOTP `changeEmail` flow, not here.
portalRouter.patch("/me", async (req: Request, res: Response) => {
  const parsed = adminProfileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile", issues: parsed.error.issues });
    return;
  }
  const id = req.admin!.user.id;
  const { firstName, lastName, phone, image } = parsed.data;

  const [current] = await db.select().from(user).where(eq(user.id, id)).limit(1);
  if (!current) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const nextFirst = firstName ?? current.firstName;
  const nextLast = lastName ?? current.lastName;

  const [updated] = await db
    .update(user)
    .set({
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(phone !== undefined && { phone }),
      ...(image !== undefined && { image }),
      // Keep the derived display name current whenever a name part changed.
      ...((firstName !== undefined || lastName !== undefined) && {
        name: deriveName(nextFirst, nextLast, current.name),
      }),
      updatedAt: new Date(),
    })
    .where(eq(user.id, id))
    .returning();

  res.json({ user: toPortalUser(updated!) });
});

// POST /api/portal/me/complete-onboarding — finish the admin onboarding wizard:
// write first/last/phone (+ optional avatar), derive `name`, mark onboarding done.
portalRouter.post(
  "/me/complete-onboarding",
  async (req: Request, res: Response) => {
    const parsed = completeOnboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid profile", issues: parsed.error.issues });
      return;
    }
    const id = req.admin!.user.id;
    const { firstName, lastName, phone, image } = parsed.data;

    const [updated] = await db
      .update(user)
      .set({
        firstName,
        lastName,
        phone,
        ...(image != null && { image }),
        name: deriveName(firstName, lastName, req.admin!.user.name),
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(user.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.json({ user: toPortalUser(updated) });
  },
);

// GET /api/portal/users — list all portal (admin) users, root first then newest.
portalRouter.get("/users", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(user)
    .where(eq(user.userType, "admin"))
    .orderBy(asc(user.createdAt));
  res.json({ users: rows.map(toPortalUser) });
});

// POST /api/portal/users/invite — invite an admin by email (email only).
portalRouter.post("/users/invite", async (req: Request, res: Response) => {
  const parsed = inviteAdminSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email", issues: parsed.error.issues });
    return;
  }
  const { email } = parsed.data;

  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existing?.adminRole === "root") {
    res.status(409).json({ error: "That email is already the root admin" });
    return;
  }

  if (existing && existing.adminRole === "admin") {
    // Already a pending/active admin → resend the invite link.
    await sendInvite(email);
    res.status(200).json({ user: toPortalUser(existing), resent: true });
    return;
  }

  if (existing) {
    // Existing worker/hirer (or partial) account → promote to admin.
    const [updated] = await db
      .update(user)
      .set({ userType: "admin", adminRole: "admin", updatedAt: new Date() })
      .where(eq(user.id, existing.id))
      .returning();
    await sendInvite(email);
    res.status(200).json({ user: toPortalUser(updated!), promoted: true });
    return;
  }

  // Brand-new pending admin.
  const [created] = await db
    .insert(user)
    .values({
      id: randomUUID(),
      name: email.split("@")[0] ?? "Admin",
      email,
      emailVerified: false,
      userType: "admin",
      adminRole: "admin",
      onboardingCompleted: false,
    })
    .returning();
  await sendInvite(email);
  res.status(201).json({ user: toPortalUser(created!) });
});

// DELETE /api/portal/users/:id — remove an admin (never root, never self).
portalRouter.delete("/users/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id);

  if (id === req.admin?.user.id) {
    res.status(400).json({ error: "You can't delete your own account" });
    return;
  }

  const [target] = await db
    .select()
    .from(user)
    .where(eq(user.id, id))
    .limit(1);

  if (!target || target.userType !== "admin") {
    res.status(404).json({ error: "Portal user not found" });
    return;
  }
  if (target.adminRole === "root") {
    res.status(400).json({ error: "The root admin can't be deleted" });
    return;
  }

  await db.delete(user).where(eq(user.id, id));
  res.status(204).end();
});

/** Send the branded invite email pointing at the web portal's login. */
async function sendInvite(email: string): Promise<void> {
  const inviteUrl = `${env.WEB_ORIGIN}/login?invited=${encodeURIComponent(email)}`;
  await sendAdminInviteEmail({ email, inviteUrl });
}
