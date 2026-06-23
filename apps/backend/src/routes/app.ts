import { Router, type Request, type Response } from "express";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  selectRoleSchema,
  workerProfileUpdateSchema,
  workerSkillsStepSchema,
  workerSubmitSchema,
  hirerProfileUpdateSchema,
  hirerSubmitSchema,
  type Category,
  type Profession,
  type RequirementField,
  type WorkerProfile,
  type HirerProfile,
  type OnboardingState,
} from "@odj/shared";
import { db } from "../db";
import {
  categories,
  professions,
  requirementFields,
  workerProfiles,
  workerProfessions,
  hirerProfiles,
  user,
} from "../db/schema";
import { requireUser } from "../middleware/require-user";

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
  };
}

function toRequirementField(
  row: typeof requirementFields.$inferSelect,
): RequirementField {
  return {
    id: row.id,
    level: row.level,
    categoryId: row.categoryId,
    professionId: row.professionId,
    key: row.key,
    label: row.label,
    inputType: row.inputType,
    required: row.required,
    options: row.options,
    allowedFileTypes: row.allowedFileTypes,
    position: row.position,
    isActive: row.isActive,
  };
}

function invalid(res: Response, error: unknown): void {
  res.status(400).json({
    error: "Invalid input",
    issues: (error as { issues?: unknown }).issues,
  });
}

// ── Effective requirement fields (active, unioned & de-duped by key) ──────────

const fieldOrder = [
  asc(requirementFields.position),
  asc(requirementFields.createdAt),
] as const;

/**
 * The cascaded requirement fields a worker must answer for the given
 * professions: catalog-level (all workers) + the professions' categories +
 * the professions themselves. Active fields only, ordered catalog → category →
 * profession (then by position), de-duped by stable `key` (first/most-general
 * wins) so a worker is never asked the same thing twice.
 */
async function effectiveFieldsForProfessions(
  professionIds: string[],
): Promise<RequirementField[]> {
  const profs = professionIds.length
    ? await db
        .select()
        .from(professions)
        .where(
          and(
            inArray(professions.id, professionIds),
            eq(professions.isActive, true),
          ),
        )
    : [];
  const categoryIds = [...new Set(profs.map((p) => p.categoryId))];
  const profIds = profs.map((p) => p.id);

  const [catalog, category, own] = await Promise.all([
    db
      .select()
      .from(requirementFields)
      .where(
        and(
          eq(requirementFields.level, "catalog"),
          isNull(requirementFields.categoryId),
          isNull(requirementFields.professionId),
          eq(requirementFields.isActive, true),
        ),
      )
      .orderBy(...fieldOrder),
    categoryIds.length
      ? db
          .select()
          .from(requirementFields)
          .where(
            and(
              inArray(requirementFields.categoryId, categoryIds),
              eq(requirementFields.isActive, true),
            ),
          )
          .orderBy(...fieldOrder)
      : Promise.resolve([]),
    profIds.length
      ? db
          .select()
          .from(requirementFields)
          .where(
            and(
              inArray(requirementFields.professionId, profIds),
              eq(requirementFields.isActive, true),
            ),
          )
          .orderBy(...fieldOrder)
      : Promise.resolve([]),
  ]);

  const byKey = new Map<string, RequirementField>();
  for (const row of [...catalog, ...category, ...own]) {
    if (!byKey.has(row.key)) byKey.set(row.key, toRequirementField(row));
  }
  return [...byKey.values()];
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

/** Ensure the signed-in user has an editable (draft) worker profile. */
async function requireDraftWorker(
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
  if (row.status !== "draft") {
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
  const current = await requireDraftWorker(u.id, res);
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
    const current = await requireDraftWorker(u.id, res);
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
    const current = await requireDraftWorker(u.id, res);
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

    await db
      .update(workerProfiles)
      .set({ status: "under_review", submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(workerProfiles.id, current.id));

    res.json(await loadOnboardingState(u.id, "worker"));
  },
);

// ── Hirer draft saves ─────────────────────────────────────────────────────────

/** Ensure the signed-in user has an editable (draft) hirer profile. */
async function requireDraftHirer(
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
  if (row.status !== "draft") {
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
  const current = await requireDraftHirer(u.id, res);
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
  const current = await requireDraftHirer(u.id, res);
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

  await db
    .update(hirerProfiles)
    .set({ status: "under_review", submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(hirerProfiles.id, current.id));

  res.json(await loadOnboardingState(u.id, "hirer"));
});
