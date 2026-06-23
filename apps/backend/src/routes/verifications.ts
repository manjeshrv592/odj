import { Router, type Request, type Response } from "express";
import { and, desc, eq, inArray, count } from "drizzle-orm";
import {
  rejectProfileSchema,
  profileKindSchema,
  LANGUAGES,
  type VerificationListItem,
  type VerificationDetail,
  type VerificationAnswer,
  type ProfileStatus,
  type ProfileKind,
} from "@odj/shared";
import { db } from "../db";
import {
  workerProfiles,
  workerProfessions,
  hirerProfiles,
  professions,
  user,
} from "../db/schema";
import { requireAdmin } from "../middleware/require-admin";
import { effectiveFieldsForProfessions } from "../lib/requirements";
import { notifyUser } from "../lib/notifications";
import {
  sendProfileApprovedEmail,
  sendProfileRejectedEmail,
} from "../lib/email";

/**
 * Admin profile-verification API (mounted `/api/portal/verifications`, behind
 * `requireAdmin`). Lists submitted worker/hirer profiles, exposes full detail for
 * a human to judge authenticity, and records approve/reject decisions — each of
 * which emails + pushes + in-app-notifies the applicant. Mirrors the other portal
 * routers: zod validate → `db` → projection.
 */
export const verificationsRouter: Router = Router();

verificationsRouter.use(requireAdmin);

const LANGUAGE_LABELS = new Map<string, string>(
  LANGUAGES.map((l) => [l.code, l.label]),
);

/** Derived display name for a profile, falling back to the user's account name. */
function displayName(
  firstName: string | null,
  lastName: string | null,
  fallback: string,
): string {
  const full = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return full || fallback;
}

function invalid(res: Response, error: unknown): void {
  res.status(400).json({
    error: "Invalid input",
    issues: (error as { issues?: unknown }).issues,
  });
}

// ── List + count ──────────────────────────────────────────────────────────────

const STATUSES: ProfileStatus[] = ["under_review", "approved", "rejected"];

/** Parse the `?status=` filter (default `under_review`; `all` ⇒ undefined). */
function parseStatusFilter(raw: unknown): ProfileStatus | undefined {
  if (raw === "all") return undefined;
  if (typeof raw === "string" && (STATUSES as string[]).includes(raw)) {
    return raw as ProfileStatus;
  }
  return "under_review";
}

/** Parse the `?type=` filter (default `all`). */
function parseTypeFilter(raw: unknown): ProfileKind | "all" {
  if (raw === "worker" || raw === "hirer") return raw;
  return "all";
}

// GET /api/portal/verifications?type=&status=
verificationsRouter.get("/", async (req: Request, res: Response) => {
  const status = parseStatusFilter(req.query.status);
  const type = parseTypeFilter(req.query.type);

  const items: VerificationListItem[] = [];

  if (type !== "hirer") {
    const rows = await db
      .select({ p: workerProfiles, u: user })
      .from(workerProfiles)
      .innerJoin(user, eq(workerProfiles.userId, user.id))
      .where(status ? eq(workerProfiles.status, status) : undefined)
      .orderBy(desc(workerProfiles.submittedAt));
    for (const { p, u } of rows) {
      items.push({
        id: p.id,
        type: "worker",
        userId: p.userId,
        name: displayName(p.firstName, p.lastName, u.name),
        city: p.city,
        state: p.state,
        photoUrl: p.photoUrl,
        status: p.status,
        submittedAt: p.submittedAt,
      });
    }
  }

  if (type !== "worker") {
    const rows = await db
      .select({ p: hirerProfiles, u: user })
      .from(hirerProfiles)
      .innerJoin(user, eq(hirerProfiles.userId, user.id))
      .where(status ? eq(hirerProfiles.status, status) : undefined)
      .orderBy(desc(hirerProfiles.submittedAt));
    for (const { p, u } of rows) {
      items.push({
        id: p.id,
        type: "hirer",
        userId: p.userId,
        name: displayName(p.firstName, p.lastName, u.name),
        city: p.city,
        state: p.state,
        photoUrl: p.photoUrl,
        status: p.status,
        submittedAt: p.submittedAt,
      });
    }
  }

  // Newest submission first across both tables.
  items.sort(
    (a, b) =>
      (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0),
  );

  res.json({ verifications: items });
});

// GET /api/portal/verifications/count — pending (under_review) total for the badge.
verificationsRouter.get("/count", async (_req: Request, res: Response) => {
  const [[w], [h]] = await Promise.all([
    db
      .select({ n: count() })
      .from(workerProfiles)
      .where(eq(workerProfiles.status, "under_review")),
    db
      .select({ n: count() })
      .from(hirerProfiles)
      .where(eq(hirerProfiles.status, "under_review")),
  ]);
  res.json({ pending: (w?.n ?? 0) + (h?.n ?? 0) });
});

// ── Detail ──────────────────────────────────────────────────────────────────

async function reviewerName(reviewedBy: string | null): Promise<string | null> {
  if (!reviewedBy) return null;
  const [row] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, reviewedBy))
    .limit(1);
  return row?.name ?? null;
}

// GET /api/portal/verifications/:type/:id
verificationsRouter.get("/:type/:id", async (req: Request, res: Response) => {
  const kind = profileKindSchema.safeParse(req.params.type);
  if (!kind.success) {
    res.status(404).json({ error: "Unknown profile type" });
    return;
  }
  const id = String(req.params.id);

  if (kind.data === "worker") {
    const [row] = await db
      .select({ p: workerProfiles, u: user })
      .from(workerProfiles)
      .innerJoin(user, eq(workerProfiles.userId, user.id))
      .where(eq(workerProfiles.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const { p, u } = row;

    const links = await db
      .select({ id: professions.id, name: professions.name })
      .from(workerProfessions)
      .innerJoin(professions, eq(workerProfessions.professionId, professions.id))
      .where(eq(workerProfessions.workerProfileId, p.id));

    // Resolve each stored answer `key` back to its field label/inputType. A key
    // with no matching active field (field edited/deleted since) is surfaced raw
    // so nothing is silently hidden.
    const fields = await effectiveFieldsForProfessions(links.map((l) => l.id));
    const byKey = new Map(fields.map((f) => [f.key, f]));
    const answers: VerificationAnswer[] = Object.entries(p.answers).map(
      ([key, value]) => {
        const f = byKey.get(key);
        return f
          ? { key, label: f.label, inputType: f.inputType, value, resolved: true }
          : { key, value, resolved: false };
      },
    );

    const detail: VerificationDetail = {
      id: p.id,
      type: "worker",
      userId: p.userId,
      email: u.email,
      firstName: p.firstName,
      lastName: p.lastName,
      photoUrl: p.photoUrl,
      city: p.city,
      state: p.state,
      lat: p.lat,
      lng: p.lng,
      status: p.status,
      submittedAt: p.submittedAt,
      professions: links.map((l) => ({ id: l.id, name: l.name })),
      languages: p.languages.map((code) => ({
        code,
        label: LANGUAGE_LABELS.get(code) ?? code,
      })),
      answers,
      reviewedAt: p.reviewedAt,
      reviewedByName: await reviewerName(p.reviewedBy),
      rejectionReason: p.rejectionReason,
    };
    res.json(detail);
    return;
  }

  // Hirer
  const [row] = await db
    .select({ p: hirerProfiles, u: user })
    .from(hirerProfiles)
    .innerJoin(user, eq(hirerProfiles.userId, user.id))
    .where(eq(hirerProfiles.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  const { p, u } = row;
  const detail: VerificationDetail = {
    id: p.id,
    type: "hirer",
    userId: p.userId,
    email: u.email,
    firstName: p.firstName,
    lastName: p.lastName,
    photoUrl: p.photoUrl,
    city: p.city,
    state: p.state,
    lat: p.lat,
    lng: p.lng,
    status: p.status,
    submittedAt: p.submittedAt,
    hirerType: p.hirerType,
    orgName: p.orgName,
    orgType: p.orgType,
    gstRegistered: p.gstRegistered,
    gstin: p.gstin,
    reviewedAt: p.reviewedAt,
    reviewedByName: await reviewerName(p.reviewedBy),
    rejectionReason: p.rejectionReason,
  };
  res.json(detail);
});

// ── Decisions (approve / reject) ───────────────────────────────────────────────

type ProfileRow =
  | { kind: "worker"; row: typeof workerProfiles.$inferSelect }
  | { kind: "hirer"; row: typeof hirerProfiles.$inferSelect };

/** Load a profile of the given kind by id, or null. */
async function loadProfile(
  kind: ProfileKind,
  id: string,
): Promise<ProfileRow | null> {
  if (kind === "worker") {
    const [row] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.id, id))
      .limit(1);
    return row ? { kind: "worker", row } : null;
  }
  const [row] = await db
    .select()
    .from(hirerProfiles)
    .where(eq(hirerProfiles.id, id))
    .limit(1);
  return row ? { kind: "hirer", row } : null;
}

/** Email + name of the applicant, for the decision email. */
async function applicantContact(
  userId: string,
  firstName: string | null,
  lastName: string | null,
): Promise<{ email: string; name: string }> {
  const [u] = await db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return {
    email: u?.email ?? "",
    name: displayName(firstName, lastName, u?.name ?? ""),
  };
}

// POST /api/portal/verifications/:type/:id/approve
verificationsRouter.post(
  "/:type/:id/approve",
  async (req: Request, res: Response) => {
    const kind = profileKindSchema.safeParse(req.params.type);
    if (!kind.success) {
      res.status(404).json({ error: "Unknown profile type" });
      return;
    }
    const id = String(req.params.id);
    const profile = await loadProfile(kind.data, id);
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    if (profile.row.status !== "under_review") {
      res.status(409).json({ error: "Profile is not awaiting review" });
      return;
    }

    const adminId = req.admin!.user.id;
    const set = {
      status: "approved" as const,
      reviewedAt: new Date(),
      reviewedBy: adminId,
      rejectionReason: null,
      updatedAt: new Date(),
    };
    if (profile.kind === "worker") {
      await db.update(workerProfiles).set(set).where(eq(workerProfiles.id, id));
    } else {
      await db.update(hirerProfiles).set(set).where(eq(hirerProfiles.id, id));
    }

    const contact = await applicantContact(
      profile.row.userId,
      profile.row.firstName,
      profile.row.lastName,
    );
    await sendProfileApprovedEmail({ email: contact.email, name: contact.name });
    await notifyUser(profile.row.userId, {
      type: "profile_approved",
      title: "Profile approved 🎉",
      body: "Your ODJ profile is verified. You're all set!",
    });

    res.json({ ok: true });
  },
);

// POST /api/portal/verifications/:type/:id/reject  { reason }
verificationsRouter.post(
  "/:type/:id/reject",
  async (req: Request, res: Response) => {
    const kind = profileKindSchema.safeParse(req.params.type);
    if (!kind.success) {
      res.status(404).json({ error: "Unknown profile type" });
      return;
    }
    const parsed = rejectProfileSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);

    const id = String(req.params.id);
    const profile = await loadProfile(kind.data, id);
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    if (profile.row.status !== "under_review") {
      res.status(409).json({ error: "Profile is not awaiting review" });
      return;
    }

    const { reason } = parsed.data;
    const adminId = req.admin!.user.id;
    const set = {
      status: "rejected" as const,
      reviewedAt: new Date(),
      reviewedBy: adminId,
      rejectionReason: reason,
      updatedAt: new Date(),
    };
    if (profile.kind === "worker") {
      await db.update(workerProfiles).set(set).where(eq(workerProfiles.id, id));
    } else {
      await db.update(hirerProfiles).set(set).where(eq(hirerProfiles.id, id));
    }

    const contact = await applicantContact(
      profile.row.userId,
      profile.row.firstName,
      profile.row.lastName,
    );
    await sendProfileRejectedEmail({
      email: contact.email,
      name: contact.name,
      reason,
    });
    await notifyUser(profile.row.userId, {
      type: "profile_rejected",
      title: "Profile needs an update",
      body: reason,
    });

    res.json({ ok: true });
  },
);
