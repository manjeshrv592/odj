import { Router, type Request, type Response } from "express";
import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import {
  selectRoleSchema,
  workerProfileUpdateSchema,
  workerSkillsStepSchema,
  workerSubmitSchema,
  hirerProfileUpdateSchema,
  hirerSubmitSchema,
  registerPushTokenSchema,
  notificationTypeSchema,
  setWorkerRatesSchema,
  toggleDayOffSchema,
  preciseLocationSchema,
  isoDateSchema,
  setOnlineSchema,
  createJobSchema,
  type Category,
  type Profession,
  type WorkerProfile,
  type HirerProfile,
  type OnboardingState,
  type Notification,
  type WorkerRateRow,
  type DayOff,
  type JobView,
  type WorkerOffer,
} from "@odj/shared";
import { db } from "../db";
import {
  categories,
  professions,
  workerProfiles,
  workerProfessions,
  workerProfessionRates,
  workerDaysOff,
  hirerProfiles,
  jobs,
  jobOffers,
  pushTokens,
  notifications,
  user,
} from "../db/schema";
import { requireUser } from "../middleware/require-user";
import { effectiveFieldsForProfessions } from "../lib/requirements";
import { notifyUser } from "../lib/notifications";
import {
  findEligibleWorkers,
  haversineKm,
  DEFAULT_RADIUS_KM,
} from "../lib/matching";

/**
 * Mobile app API for workers & hirers. Authenticated (`requireUser`, non-admin)
 * and mounted at `/api/app`. Provides the read-only catalog the onboarding
 * wizard needs (active rows only), the resumable per-step profile saves, and the
 * final submit that moves a draft to `under_review`. Mirrors `catalog.ts` style:
 * zod validate → `db` → projection.
 */
export const appRouter: Router = Router();

appRouter.use(requireUser);

// ── Projections ──────────────────────────────────────────────────────────────

function toCategory(row: typeof categories.$inferSelect): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    image: row.image,
    isActive: row.isActive,
  };
}

function toProfession(row: typeof professions.$inferSelect): Profession {
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: row.name,
    slug: row.slug,
    isActive: row.isActive,
    position: row.position,
    dailyMin: row.dailyMin,
    dailyMax: row.dailyMax,
    hourlyMin: row.hourlyMin,
    hourlyMax: row.hourlyMax,
  };
}

function invalid(res: Response, error: unknown): void {
  res.status(400).json({
    error: "Invalid input",
    issues: (error as { issues?: unknown }).issues,
  });
}

// ── Profile loaders ───────────────────────────────────────────────────────────

async function loadWorkerProfile(userId: string): Promise<WorkerProfile | null> {
  const [row] = await db
    .select()
    .from(workerProfiles)
    .where(eq(workerProfiles.userId, userId))
    .limit(1);
  if (!row) return null;
  const links = await db
    .select({ professionId: workerProfessions.professionId })
    .from(workerProfessions)
    .where(eq(workerProfessions.workerProfileId, row.id));
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    photoUrl: row.photoUrl,
    city: row.city,
    state: row.state,
    lat: row.lat,
    lng: row.lng,
    professionIds: links.map((l) => l.professionId),
    languages: row.languages,
    answers: row.answers,
    status: row.status,
    currentStep: row.currentStep,
    rejectionReason: row.rejectionReason,
    locationCapturedAt: row.locationCapturedAt,
    availabilityReviewedAt: row.availabilityReviewedAt,
    setupCompletedAt: row.setupCompletedAt,
    isOnline: row.isOnline,
  };
}

async function loadHirerProfile(userId: string): Promise<HirerProfile | null> {
  const [row] = await db
    .select()
    .from(hirerProfiles)
    .where(eq(hirerProfiles.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    photoUrl: row.photoUrl,
    city: row.city,
    state: row.state,
    lat: row.lat,
    lng: row.lng,
    hirerType: row.hirerType,
    orgName: row.orgName,
    orgType: row.orgType,
    gstRegistered: row.gstRegistered,
    gstin: row.gstin,
    status: row.status,
    currentStep: row.currentStep,
    rejectionReason: row.rejectionReason,
  };
}

/** Build the GET /me onboarding state for a user. */
async function loadOnboardingState(
  userId: string,
  userType: string | null,
): Promise<OnboardingState> {
  if (userType === "worker") {
    const worker = await loadWorkerProfile(userId);
    return {
      userType: "worker",
      status: worker?.status ?? null,
      currentStep: worker?.currentStep ?? null,
      worker,
    };
  }
  if (userType === "hirer") {
    const hirer = await loadHirerProfile(userId);
    return {
      userType: "hirer",
      status: hirer?.status ?? null,
      currentStep: hirer?.currentStep ?? null,
      hirer,
    };
  }
  return { userType: null, status: null, currentStep: null };
}

// ── Catalog reads (active only) ───────────────────────────────────────────────

// GET /api/app/catalog/categories — active categories (name order).
appRouter.get("/catalog/categories", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.name));
  res.json({ categories: rows.map(toCategory) });
});

// GET /api/app/catalog/categories/:id/professions — active professions in it.
appRouter.get(
  "/catalog/categories/:id/professions",
  async (req: Request, res: Response) => {
    const categoryId = String(req.params.id);
    const rows = await db
      .select()
      .from(professions)
      .where(
        and(
          eq(professions.categoryId, categoryId),
          eq(professions.isActive, true),
        ),
      )
      .orderBy(asc(professions.position), asc(professions.createdAt));
    res.json({ professions: rows.map(toProfession) });
  },
);

// GET /api/app/catalog/effective-requirements?professionIds=a,b,c
appRouter.get(
  "/catalog/effective-requirements",
  async (req: Request, res: Response) => {
    const raw = req.query.professionIds;
    const ids = (typeof raw === "string" ? raw.split(",") : [])
      .map((s) => s.trim())
      .filter(Boolean);
    const fields = await effectiveFieldsForProfessions(ids);
    res.json({ fields });
  },
);

// ── Onboarding state + role selection ─────────────────────────────────────────

// GET /api/app/me — onboarding state for resume + SessionGate routing.
appRouter.get("/me", async (req: Request, res: Response) => {
  const u = req.appUser!;
  res.json(await loadOnboardingState(u.id, u.userType));
});

// POST /api/app/onboarding/role — pick Work/Hire (idempotent); creates the draft.
appRouter.post("/onboarding/role", async (req: Request, res: Response) => {
  const parsed = selectRoleSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  const u = req.appUser!;
  const { userType } = parsed.data;

  if (u.userType && u.userType !== userType) {
    res.status(409).json({ error: "Role already chosen" });
    return;
  }

  // `userType` is `input:false` on better-auth, so write the row directly.
  if (u.userType !== userType) {
    await db.update(user).set({ userType }).where(eq(user.id, u.id));
  }
  if (userType === "worker") {
    await db
      .insert(workerProfiles)
      .values({ userId: u.id })
      .onConflictDoNothing();
  } else {
    await db
      .insert(hirerProfiles)
      .values({ userId: u.id })
      .onConflictDoNothing();
  }

  res.json(await loadOnboardingState(u.id, userType));
});

// ── Worker draft saves ────────────────────────────────────────────────────────

/**
 * Ensure the signed-in user has an *editable* worker profile. Editable means
 * `draft` (first run) or `rejected` (the applicant is fixing it to re-submit);
 * `under_review` and `approved` are locked.
 */
async function requireEditableWorker(
  userId: string,
  res: Response,
): Promise<typeof workerProfiles.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(workerProfiles)
    .where(eq(workerProfiles.userId, userId))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Start onboarding as a worker first" });
    return null;
  }
  if (row.status !== "draft" && row.status !== "rejected") {
    res.status(409).json({ error: "Profile already submitted" });
    return null;
  }
  return row;
}

// PATCH /api/app/worker-profile — partial per-step save.
appRouter.patch("/worker-profile", async (req: Request, res: Response) => {
  const parsed = workerProfileUpdateSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  const u = req.appUser!;
  const current = await requireEditableWorker(u.id, res);
  if (!current) return;

  const d = parsed.data;
  await db
    .update(workerProfiles)
    .set({
      ...(d.firstName !== undefined && { firstName: d.firstName }),
      ...(d.lastName !== undefined && { lastName: d.lastName }),
      ...(d.photoUrl !== undefined && { photoUrl: d.photoUrl ?? null }),
      ...(d.city !== undefined && { city: d.city }),
      ...(d.state !== undefined && { state: d.state }),
      ...(d.lat !== undefined && { lat: d.lat ?? null }),
      ...(d.lng !== undefined && { lng: d.lng ?? null }),
      ...(d.languages !== undefined && { languages: d.languages }),
      ...(d.answers !== undefined && { answers: d.answers }),
      ...(d.currentStep !== undefined && { currentStep: d.currentStep }),
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.id, current.id));

  res.json(await loadOnboardingState(u.id, "worker"));
});

// PUT /api/app/worker-profile/professions — replace the chosen professions.
appRouter.put(
  "/worker-profile/professions",
  async (req: Request, res: Response) => {
    const parsed = workerSkillsStepSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const u = req.appUser!;
    const current = await requireEditableWorker(u.id, res);
    if (!current) return;

    const { professionIds } = parsed.data;
    const existing = await db
      .select({ id: professions.id })
      .from(professions)
      .where(
        and(
          inArray(professions.id, professionIds),
          eq(professions.isActive, true),
        ),
      );
    if (existing.length !== professionIds.length) {
      res.status(400).json({ error: "One or more professions are invalid" });
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(workerProfessions)
        .where(eq(workerProfessions.workerProfileId, current.id));
      await tx.insert(workerProfessions).values(
        professionIds.map((professionId) => ({
          workerProfileId: current.id,
          professionId,
        })),
      );
    });

    res.json(await loadOnboardingState(u.id, "worker"));
  },
);

// POST /api/app/worker-profile/submit — validate everything → under_review.
appRouter.post(
  "/worker-profile/submit",
  async (req: Request, res: Response) => {
    const u = req.appUser!;
    const current = await requireEditableWorker(u.id, res);
    if (!current) return;

    const fixed = workerSubmitSchema.safeParse({
      firstName: current.firstName,
      lastName: current.lastName,
      photoUrl: current.photoUrl,
      city: current.city,
      state: current.state,
      languages: current.languages,
    });
    if (!fixed.success) {
      console.warn(
        "[submit:worker] static fields rejected:",
        fixed.error.issues.map((i) => i.path.join(".")).join(", "),
      );
      return invalid(res, fixed.error);
    }

    const links = await db
      .select({ professionId: workerProfessions.professionId })
      .from(workerProfessions)
      .where(eq(workerProfessions.workerProfileId, current.id));
    if (links.length === 0) {
      res.status(400).json({ error: "Pick at least one profession" });
      return;
    }

    const fields = await effectiveFieldsForProfessions(
      links.map((l) => l.professionId),
    );
    const missing = fields
      .filter((f) => f.required)
      .filter((f) => {
        const a = current.answers[f.key];
        return (
          a === undefined ||
          (typeof a === "string" && a.trim() === "") ||
          (Array.isArray(a) && a.length === 0)
        );
      })
      .map((f) => f.key);
    if (missing.length > 0) {
      console.warn("[submit:worker] missing required answers:", missing.join(", "));
      res.status(400).json({ error: "Some required fields are missing", missing });
      return;
    }

    // Re-submitting after a rejection clears the prior decision so the row is a
    // clean `under_review` again.
    await db
      .update(workerProfiles)
      .set({
        status: "under_review",
        submittedAt: new Date(),
        updatedAt: new Date(),
        rejectionReason: null,
        reviewedAt: null,
        reviewedBy: null,
      })
      .where(eq(workerProfiles.id, current.id));

    res.json(await loadOnboardingState(u.id, "worker"));
  },
);

// ── Worker post-approval: rates, availability, location ────────────────────────

/**
 * Ensure the signed-in user has an *approved* worker profile. Rates, day-off
 * availability, and precise location are only meaningful once verified, so these
 * endpoints are gated separately from the editable (draft/rejected) onboarding.
 */
async function requireApprovedWorker(
  userId: string,
  res: Response,
): Promise<typeof workerProfiles.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(workerProfiles)
    .where(eq(workerProfiles.userId, userId))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "No worker profile" });
    return null;
  }
  if (row.status !== "approved") {
    res.status(403).json({ error: "Profile not approved yet" });
    return null;
  }
  return row;
}

/** A worker's chosen professions (id + name) — basis for rates & availability. */
async function workerProfessionRows(workerProfileId: string) {
  return db
    .select({
      id: professions.id,
      name: professions.name,
      dailyMin: professions.dailyMin,
      dailyMax: professions.dailyMax,
      hourlyMin: professions.hourlyMin,
      hourlyMax: professions.hourlyMax,
    })
    .from(workerProfessions)
    .innerJoin(professions, eq(workerProfessions.professionId, professions.id))
    .where(eq(workerProfessions.workerProfileId, workerProfileId))
    .orderBy(asc(professions.name));
}

// GET /api/app/worker/rates — the worker's professions with admin bounds + set rates.
appRouter.get("/worker/rates", async (req: Request, res: Response) => {
  const u = req.appUser!;
  const profile = await requireApprovedWorker(u.id, res);
  if (!profile) return;

  const profs = await workerProfessionRows(profile.id);
  const existing = await db
    .select()
    .from(workerProfessionRates)
    .where(eq(workerProfessionRates.workerProfileId, profile.id));
  const byProfession = new Map(existing.map((r) => [r.professionId, r]));

  const rates: WorkerRateRow[] = profs.map((p) => {
    const rate = byProfession.get(p.id);
    return {
      professionId: p.id,
      name: p.name,
      dailyMin: p.dailyMin,
      dailyMax: p.dailyMax,
      hourlyMin: p.hourlyMin,
      hourlyMax: p.hourlyMax,
      dailyRate: rate?.dailyRate ?? null,
      hourlyRate: rate?.hourlyRate ?? null,
    };
  });
  res.json({ rates });
});

// PUT /api/app/worker/rates — set rates (validated against live bounds + ownership).
appRouter.put("/worker/rates", async (req: Request, res: Response) => {
  const parsed = setWorkerRatesSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  const u = req.appUser!;
  const profile = await requireApprovedWorker(u.id, res);
  if (!profile) return;

  const profs = await workerProfessionRows(profile.id);
  const byId = new Map(profs.map((p) => [p.id, p]));

  // Validate every entry before writing anything.
  for (const entry of parsed.data.rates) {
    const p = byId.get(entry.professionId);
    if (!p) {
      res.status(400).json({ error: "Not one of your professions" });
      return;
    }
    const checks = [
      { unit: "daily", rate: entry.dailyRate, min: p.dailyMin, max: p.dailyMax },
      {
        unit: "hourly",
        rate: entry.hourlyRate,
        min: p.hourlyMin,
        max: p.hourlyMax,
      },
    ] as const;
    for (const c of checks) {
      if (c.rate === undefined || c.rate === null) continue;
      if (c.min === null || c.max === null) {
        res.status(400).json({ error: `${c.unit} rate not offered for ${p.name}` });
        return;
      }
      if (c.rate < c.min || c.rate > c.max) {
        res.status(400).json({
          error: `${c.unit} rate for ${p.name} must be ₹${c.min}–₹${c.max}`,
        });
        return;
      }
    }
  }

  for (const entry of parsed.data.rates) {
    await db
      .insert(workerProfessionRates)
      .values({
        workerProfileId: profile.id,
        professionId: entry.professionId,
        dailyRate: entry.dailyRate ?? null,
        hourlyRate: entry.hourlyRate ?? null,
      })
      .onConflictDoUpdate({
        target: [
          workerProfessionRates.workerProfileId,
          workerProfessionRates.professionId,
        ],
        set: {
          dailyRate: entry.dailyRate ?? null,
          hourlyRate: entry.hourlyRate ?? null,
          updatedAt: new Date(),
        },
      });
  }

  res.status(204).end();
});

// GET /api/app/worker/days-off?from=&to= — days off in the (inclusive) range.
appRouter.get("/worker/days-off", async (req: Request, res: Response) => {
  const u = req.appUser!;
  const profile = await requireApprovedWorker(u.id, res);
  if (!profile) return;

  const from = isoDateSchema.safeParse(req.query.from);
  const to = isoDateSchema.safeParse(req.query.to);
  const where = [eq(workerDaysOff.workerProfileId, profile.id)];
  if (from.success) where.push(gte(workerDaysOff.date, from.data));
  if (to.success) where.push(lte(workerDaysOff.date, to.data));

  const rows = await db
    .select({ date: workerDaysOff.date, professionId: workerDaysOff.professionId })
    .from(workerDaysOff)
    .where(and(...where))
    .orderBy(asc(workerDaysOff.date));

  const daysOff: DayOff[] = rows.map((r) => ({
    date: r.date,
    professionId: r.professionId,
  }));
  res.json({ daysOff });
});

// PUT /api/app/worker/days-off — toggle one day off for a scope (all / profession).
appRouter.put("/worker/days-off", async (req: Request, res: Response) => {
  const parsed = toggleDayOffSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  const u = req.appUser!;
  const profile = await requireApprovedWorker(u.id, res);
  if (!profile) return;

  const { date, scope, off } = parsed.data;
  const professionId = scope === "all" ? null : scope;

  if (professionId) {
    const owns = await db
      .select({ id: workerProfessions.professionId })
      .from(workerProfessions)
      .where(
        and(
          eq(workerProfessions.workerProfileId, profile.id),
          eq(workerProfessions.professionId, professionId),
        ),
      )
      .limit(1);
    if (owns.length === 0) {
      res.status(400).json({ error: "Not one of your professions" });
      return;
    }
  }

  // `professionId` is nullable, so match it explicitly (NULL = all-professions row).
  const scopeMatch = and(
    eq(workerDaysOff.workerProfileId, profile.id),
    eq(workerDaysOff.date, date),
    professionId === null
      ? isNull(workerDaysOff.professionId)
      : eq(workerDaysOff.professionId, professionId),
  );

  if (off) {
    const existing = await db
      .select({ id: workerDaysOff.id })
      .from(workerDaysOff)
      .where(scopeMatch)
      .limit(1);
    if (existing.length === 0) {
      await db
        .insert(workerDaysOff)
        .values({ workerProfileId: profile.id, professionId, date });
    }
  } else {
    await db.delete(workerDaysOff).where(scopeMatch);
  }

  res.status(204).end();
});

// POST /api/app/worker/location — high-accuracy precise location capture.
appRouter.post("/worker/location", async (req: Request, res: Response) => {
  const parsed = preciseLocationSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  const u = req.appUser!;
  const profile = await requireApprovedWorker(u.id, res);
  if (!profile) return;

  const { lat, lng, accuracy } = parsed.data;
  await db
    .update(workerProfiles)
    .set({
      lat,
      lng,
      locationAccuracy: accuracy ?? null,
      locationCapturedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.id, profile.id));

  res.status(204).end();
});

// POST /api/app/worker/availability/reviewed — mark the (optional) day-off step
// acknowledged (drives the dashboard checkmark). Idempotent.
appRouter.post(
  "/worker/availability/reviewed",
  async (req: Request, res: Response) => {
    const u = req.appUser!;
    const profile = await requireApprovedWorker(u.id, res);
    if (!profile) return;
    await db
      .update(workerProfiles)
      .set({ availabilityReviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(workerProfiles.id, profile.id));
    res.status(204).end();
  },
);

// POST /api/app/worker/setup/complete — finish or skip the dashboard setup flow
// (routes the worker to their home from now on). Idempotent.
appRouter.post("/worker/setup/complete", async (req: Request, res: Response) => {
  const u = req.appUser!;
  const profile = await requireApprovedWorker(u.id, res);
  if (!profile) return;
  await db
    .update(workerProfiles)
    .set({ setupCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(workerProfiles.id, profile.id));
  res.status(204).end();
});

// ── Hiring / matching (jobs + offers) ─────────────────────────────────────────

/** Job stays open this long before it auto-expires (lazy, checked on read). */
const JOB_TTL_MS = 60_000;

/** Ensure the signed-in user has an *approved* hirer profile. */
async function requireApprovedHirer(
  userId: string,
  res: Response,
): Promise<typeof hirerProfiles.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(hirerProfiles)
    .where(eq(hirerProfiles.userId, userId))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "No hirer profile" });
    return null;
  }
  if (row.status !== "approved") {
    res.status(403).json({ error: "Profile not approved yet" });
    return null;
  }
  return row;
}

/** Project a job row to the hirer-facing view (+ matched worker when matched). */
async function loadJobView(jobId: string): Promise<JobView | null> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) return null;

  let matchedWorker: JobView["matchedWorker"] = null;
  if (job.status === "matched" && job.matchedWorkerProfileId) {
    const [w] = await db
      .select({
        firstName: workerProfiles.firstName,
        lastName: workerProfiles.lastName,
        lat: workerProfiles.lat,
        lng: workerProfiles.lng,
      })
      .from(workerProfiles)
      .where(eq(workerProfiles.id, job.matchedWorkerProfileId))
      .limit(1);
    if (w) {
      matchedWorker = {
        name: [w.firstName, w.lastName].filter(Boolean).join(" ") || "Worker",
        lat: w.lat,
        lng: w.lng,
      };
    }
  }
  return {
    id: job.id,
    status: job.status,
    professionId: job.professionId,
    matchedWorker,
  };
}

// POST /api/app/worker/online — set the worker's availability presence.
appRouter.post("/worker/online", async (req: Request, res: Response) => {
  const parsed = setOnlineSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  const u = req.appUser!;
  const profile = await requireApprovedWorker(u.id, res);
  if (!profile) return;
  await db
    .update(workerProfiles)
    .set({
      isOnline: parsed.data.online,
      lastOnlineAt: parsed.data.online ? new Date() : profile.lastOnlineAt,
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.id, profile.id));
  res.json({ online: parsed.data.online });
});

// GET /api/app/worker/offers — this worker's pending offers on still-open jobs.
appRouter.get("/worker/offers", async (req: Request, res: Response) => {
  const u = req.appUser!;
  const profile = await requireApprovedWorker(u.id, res);
  if (!profile) return;

  const rows = await db
    .select({
      offerId: jobOffers.id,
      jobId: jobs.id,
      professionName: professions.name,
      jobLat: jobs.lat,
      jobLng: jobs.lng,
      createdAt: jobOffers.createdAt,
    })
    .from(jobOffers)
    .innerJoin(jobs, eq(jobOffers.jobId, jobs.id))
    .innerJoin(professions, eq(jobs.professionId, professions.id))
    .where(
      and(
        eq(jobOffers.workerProfileId, profile.id),
        eq(jobOffers.status, "pending"),
        eq(jobs.status, "searching"),
        gte(jobs.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(jobOffers.createdAt));

  const offers: WorkerOffer[] = rows.map((r) => ({
    offerId: r.offerId,
    jobId: r.jobId,
    professionName: r.professionName,
    distanceKm:
      profile.lat != null && profile.lng != null
        ? Math.round(
            haversineKm(profile.lat, profile.lng, r.jobLat, r.jobLng) * 10,
          ) / 10
        : 0,
    createdAt: r.createdAt,
  }));
  res.json({ offers });
});

// POST /api/app/worker/offers/:id/accept — first-accept-wins (race-safe).
appRouter.post(
  "/worker/offers/:id/accept",
  async (req: Request, res: Response) => {
    const u = req.appUser!;
    const profile = await requireApprovedWorker(u.id, res);
    if (!profile) return;

    const [offer] = await db
      .select()
      .from(jobOffers)
      .where(
        and(
          eq(jobOffers.id, String(req.params.id)),
          eq(jobOffers.workerProfileId, profile.id),
        ),
      )
      .limit(1);
    if (!offer) {
      res.status(404).json({ error: "Offer not found" });
      return;
    }
    if (offer.status !== "pending") {
      res.status(409).json({ error: "This request is no longer available" });
      return;
    }

    // Atomically claim the job: only one worker can flip it out of `searching`.
    const claimed = await db.transaction(async (tx) => {
      const [job] = await tx
        .update(jobs)
        .set({
          status: "matched",
          matchedWorkerProfileId: profile.id,
          updatedAt: new Date(),
        })
        .where(and(eq(jobs.id, offer.jobId), eq(jobs.status, "searching")))
        .returning();
      if (!job) return null; // someone else won, or it was cancelled/expired

      await tx
        .update(jobOffers)
        .set({ status: "accepted", respondedAt: new Date() })
        .where(eq(jobOffers.id, offer.id));
      await tx
        .update(jobOffers)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(jobOffers.jobId, offer.jobId),
            eq(jobOffers.status, "pending"),
          ),
        );
      return job;
    });

    if (!claimed) {
      res.status(409).json({ error: "Already taken by another worker" });
      return;
    }

    // Notify the hirer their request was accepted.
    const [hirer] = await db
      .select({ userId: hirerProfiles.userId })
      .from(hirerProfiles)
      .where(eq(hirerProfiles.id, claimed.hirerProfileId))
      .limit(1);
    if (hirer) {
      const name =
        [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
        "A worker";
      await notifyUser(hirer.userId, {
        type: "job_matched",
        title: "Worker found!",
        body: `${name} accepted your request.`,
        data: { jobId: claimed.id },
      });
    }
    res.json({ ok: true });
  },
);

// POST /api/app/worker/offers/:id/decline — decline one pending offer.
appRouter.post(
  "/worker/offers/:id/decline",
  async (req: Request, res: Response) => {
    const u = req.appUser!;
    const profile = await requireApprovedWorker(u.id, res);
    if (!profile) return;
    await db
      .update(jobOffers)
      .set({ status: "declined", respondedAt: new Date() })
      .where(
        and(
          eq(jobOffers.id, String(req.params.id)),
          eq(jobOffers.workerProfileId, profile.id),
          eq(jobOffers.status, "pending"),
        ),
      );
    res.status(204).end();
  },
);

// POST /api/app/jobs — hirer starts a search: find workers, create offers, push.
appRouter.post("/jobs", async (req: Request, res: Response) => {
  const parsed = createJobSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  const u = req.appUser!;
  const hirer = await requireApprovedHirer(u.id, res);
  if (!hirer) return;
  const { professionId, lat, lng } = parsed.data;

  const [profession] = await db
    .select({ name: professions.name })
    .from(professions)
    .where(eq(professions.id, professionId))
    .limit(1);
  if (!profession) {
    res.status(400).json({ error: "Unknown profession" });
    return;
  }

  const eligible = await findEligibleWorkers(
    professionId,
    lat,
    lng,
    DEFAULT_RADIUS_KM,
  );

  const [job] = await db
    .insert(jobs)
    .values({
      hirerProfileId: hirer.id,
      professionId,
      lat,
      lng,
      radiusKm: DEFAULT_RADIUS_KM,
      status: eligible.length > 0 ? "searching" : "no_workers",
      expiresAt: new Date(Date.now() + JOB_TTL_MS),
    })
    .returning();

  if (eligible.length > 0) {
    const offerRows = await db
      .insert(jobOffers)
      .values(
        eligible.map((w) => ({ jobId: job!.id, workerProfileId: w.workerProfileId })),
      )
      .returning({
        id: jobOffers.id,
        workerProfileId: jobOffers.workerProfileId,
      });

    for (const w of eligible) {
      const offer = offerRows.find(
        (o) => o.workerProfileId === w.workerProfileId,
      );
      await notifyUser(w.userId, {
        type: "job_offer",
        title: "New job request",
        body: `A hirer nearby needs a ${profession.name}. Tap to respond.`,
        data: { jobId: job!.id, offerId: offer?.id },
      });
    }
  }

  res.json(await loadJobView(job!.id));
});

// GET /api/app/jobs/:id — hirer polls their job (lazy-expires stale searches).
appRouter.get("/jobs/:id", async (req: Request, res: Response) => {
  const u = req.appUser!;
  const hirer = await requireApprovedHirer(u.id, res);
  if (!hirer) return;

  const [job] = await db
    .select()
    .from(jobs)
    .where(
      and(eq(jobs.id, String(req.params.id)), eq(jobs.hirerProfileId, hirer.id)),
    )
    .limit(1);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  // Lazy expiry: a still-searching job past its TTL becomes `expired`.
  if (job.status === "searching" && job.expiresAt < new Date()) {
    await db
      .update(jobs)
      .set({ status: "expired", updatedAt: new Date() })
      .where(and(eq(jobs.id, job.id), eq(jobs.status, "searching")));
    await db
      .update(jobOffers)
      .set({ status: "expired" })
      .where(and(eq(jobOffers.jobId, job.id), eq(jobOffers.status, "pending")));
  }

  res.json(await loadJobView(job.id));
});

// POST /api/app/jobs/:id/cancel — hirer stops an in-progress search.
appRouter.post("/jobs/:id/cancel", async (req: Request, res: Response) => {
  const u = req.appUser!;
  const hirer = await requireApprovedHirer(u.id, res);
  if (!hirer) return;

  const [job] = await db
    .update(jobs)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(jobs.id, String(req.params.id)),
        eq(jobs.hirerProfileId, hirer.id),
        eq(jobs.status, "searching"),
      ),
    )
    .returning({ id: jobs.id });
  if (job) {
    await db
      .update(jobOffers)
      .set({ status: "cancelled" })
      .where(and(eq(jobOffers.jobId, job.id), eq(jobOffers.status, "pending")));
  }
  res.status(204).end();
});

// ── Hirer draft saves ─────────────────────────────────────────────────────────

/**
 * Ensure the signed-in user has an *editable* hirer profile — `draft` or
 * `rejected` (see {@link requireEditableWorker}).
 */
async function requireEditableHirer(
  userId: string,
  res: Response,
): Promise<typeof hirerProfiles.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(hirerProfiles)
    .where(eq(hirerProfiles.userId, userId))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Start onboarding as a hirer first" });
    return null;
  }
  if (row.status !== "draft" && row.status !== "rejected") {
    res.status(409).json({ error: "Profile already submitted" });
    return null;
  }
  return row;
}

// PATCH /api/app/hirer-profile — partial per-step save.
appRouter.patch("/hirer-profile", async (req: Request, res: Response) => {
  const parsed = hirerProfileUpdateSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  const u = req.appUser!;
  const current = await requireEditableHirer(u.id, res);
  if (!current) return;

  const d = parsed.data;
  await db
    .update(hirerProfiles)
    .set({
      ...(d.firstName !== undefined && { firstName: d.firstName }),
      ...(d.lastName !== undefined && { lastName: d.lastName }),
      ...(d.photoUrl !== undefined && { photoUrl: d.photoUrl ?? null }),
      ...(d.city !== undefined && { city: d.city }),
      ...(d.state !== undefined && { state: d.state }),
      ...(d.lat !== undefined && { lat: d.lat ?? null }),
      ...(d.lng !== undefined && { lng: d.lng ?? null }),
      ...(d.hirerType !== undefined && { hirerType: d.hirerType }),
      ...(d.orgName !== undefined && { orgName: d.orgName ?? null }),
      ...(d.orgType !== undefined && { orgType: d.orgType ?? null }),
      ...(d.gstRegistered !== undefined && { gstRegistered: d.gstRegistered }),
      ...(d.gstin !== undefined && { gstin: d.gstin ?? null }),
      ...(d.currentStep !== undefined && { currentStep: d.currentStep }),
      updatedAt: new Date(),
    })
    .where(eq(hirerProfiles.id, current.id));

  res.json(await loadOnboardingState(u.id, "hirer"));
});

// POST /api/app/hirer-profile/submit — validate everything → under_review.
appRouter.post("/hirer-profile/submit", async (req: Request, res: Response) => {
  const u = req.appUser!;
  const current = await requireEditableHirer(u.id, res);
  if (!current) return;

  const parsed = hirerSubmitSchema.safeParse({
    firstName: current.firstName,
    lastName: current.lastName,
    photoUrl: current.photoUrl,
    city: current.city,
    state: current.state,
    hirerType: current.hirerType,
    orgName: current.orgName,
    orgType: current.orgType,
    gstRegistered: current.gstRegistered,
    gstin: current.gstin,
  });
  if (!parsed.success) {
    console.warn(
      "[submit:hirer] rejected:",
      parsed.error.issues.map((i) => i.path.join(".")).join(", "),
    );
    return invalid(res, parsed.error);
  }

  // Re-submitting after a rejection clears the prior decision.
  await db
    .update(hirerProfiles)
    .set({
      status: "under_review",
      submittedAt: new Date(),
      updatedAt: new Date(),
      rejectionReason: null,
      reviewedAt: null,
      reviewedBy: null,
    })
    .where(eq(hirerProfiles.id, current.id));

  res.json(await loadOnboardingState(u.id, "hirer"));
});

// ── Push tokens + in-app notifications ─────────────────────────────────────────

function toNotification(row: typeof notifications.$inferSelect): Notification {
  return {
    id: row.id,
    type: notificationTypeSchema.catch("profile_approved").parse(row.type),
    title: row.title,
    body: row.body,
    read: row.read,
    createdAt: row.createdAt,
    data: row.data,
  };
}

// POST /api/app/push-tokens — register/refresh this device's Expo push token.
appRouter.post("/push-tokens", async (req: Request, res: Response) => {
  const parsed = registerPushTokenSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  const u = req.appUser!;
  const { token, platform } = parsed.data;

  // Token is unique per device; on re-register re-point it at the current user.
  await db
    .insert(pushTokens)
    .values({ userId: u.id, token, platform: platform ?? null })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: { userId: u.id, platform: platform ?? null, updatedAt: new Date() },
    });

  res.status(204).end();
});

// GET /api/app/notifications — this user's notifications, newest first.
appRouter.get("/notifications", async (req: Request, res: Response) => {
  const u = req.appUser!;
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, u.id))
    .orderBy(desc(notifications.createdAt));
  res.json({ notifications: rows.map(toNotification) });
});

// POST /api/app/notifications/read-all — mark every notification read.
appRouter.post("/notifications/read-all", async (req: Request, res: Response) => {
  const u = req.appUser!;
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, u.id));
  res.status(204).end();
});

// POST /api/app/notifications/:id/read — mark one notification read (owner-scoped).
appRouter.post("/notifications/:id/read", async (req: Request, res: Response) => {
  const u = req.appUser!;
  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.id, String(req.params.id)),
        eq(notifications.userId, u.id),
      ),
    );
  res.status(204).end();
});
