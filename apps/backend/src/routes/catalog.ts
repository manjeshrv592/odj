import { Router, type Request, type Response } from "express";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  createCategorySchema,
  updateCategorySchema,
  createProfessionSchema,
  updateProfessionSchema,
  createRequirementFieldSchema,
  updateRequirementFieldSchema,
  requirementLevelSchema,
  slugify,
  type Category,
  type Profession,
  type RequirementField,
  type RequirementLevel,
} from "@odj/shared";
import { db } from "../db";
import { categories, professions, requirementFields } from "../db/schema";
import { requireAdmin } from "../middleware/require-admin";

/**
 * Catalog authoring API: Categories, Professions, and the cascading requirement
 * fields (catalog → category → profession). Admin-only (`requireAdmin`). Mounted
 * at `/api/portal/catalog`. Slugs are auto-generated and kept unique server-side;
 * requirement-field `key`s are stable and generated once on create.
 */
export const catalogRouter: Router = Router();

catalogRouter.use(requireAdmin);

// ── Projections (DB row → public shape) ──────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Pick the first non-colliding slug from `base`, appending `-2`, `-3`, … against
 * the set of `taken` slugs. `base` falls back to `fallback` when empty.
 */
function pickUnique(base: string, taken: Set<string>, fallback = "item"): string {
  const root = base || fallback;
  if (!taken.has(root)) return root;
  for (let n = 2; ; n++) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Existing category slugs (optionally excluding one id, for updates). */
async function categorySlugs(excludeId?: string): Promise<Set<string>> {
  const rows = await db
    .select({ id: categories.id, slug: categories.slug })
    .from(categories);
  return new Set(rows.filter((r) => r.id !== excludeId).map((r) => r.slug));
}

/** Existing profession slugs within a category (optionally excluding one id). */
async function professionSlugs(
  categoryId: string,
  excludeId?: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ id: professions.id, slug: professions.slug })
    .from(professions)
    .where(eq(professions.categoryId, categoryId));
  return new Set(rows.filter((r) => r.id !== excludeId).map((r) => r.slug));
}

/** SQL scope predicate for requirement fields at a given level/target. */
function scopeWhere(
  level: RequirementLevel,
  categoryId?: string | null,
  professionId?: string | null,
) {
  if (level === "category") {
    return eq(requirementFields.categoryId, categoryId!);
  }
  if (level === "profession") {
    return eq(requirementFields.professionId, professionId!);
  }
  // catalog: both targets null
  return and(
    eq(requirementFields.level, "catalog"),
    isNull(requirementFields.categoryId),
    isNull(requirementFields.professionId),
  );
}

/** Existing requirement-field keys within a scope (for stable-key uniqueness). */
async function requirementKeys(
  level: RequirementLevel,
  categoryId?: string | null,
  professionId?: string | null,
): Promise<Set<string>> {
  const rows = await db
    .select({ key: requirementFields.key })
    .from(requirementFields)
    .where(scopeWhere(level, categoryId, professionId));
  return new Set(rows.map((r) => r.key));
}

/** Next position (max + 1) for a requirement-field scope. */
async function nextRequirementPosition(
  level: RequirementLevel,
  categoryId?: string | null,
  professionId?: string | null,
): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${requirementFields.position}), -1)` })
    .from(requirementFields)
    .where(scopeWhere(level, categoryId, professionId));
  return (row?.max ?? -1) + 1;
}

function invalid(res: Response, error: unknown): void {
  res.status(400).json({
    error: "Invalid input",
    issues: (error as { issues?: unknown }).issues,
  });
}

// ── Categories ────────────────────────────────────────────────────────────────

// GET /api/portal/catalog/categories — list all categories (name order).
catalogRouter.get("/categories", async (_req: Request, res: Response) => {
  const rows = await db.select().from(categories).orderBy(asc(categories.name));
  res.json({ categories: rows.map(toCategory) });
});

// POST /api/portal/catalog/categories — create (slug auto-generated from name).
catalogRouter.post("/categories", async (req: Request, res: Response) => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  const { name, description, image } = parsed.data;

  const slug = pickUnique(slugify(name), await categorySlugs(), "category");
  const [created] = await db
    .insert(categories)
    .values({ name, slug, description: description ?? null, image: image ?? null })
    .returning();
  res.status(201).json({ category: toCategory(created!) });
});

// GET /api/portal/catalog/categories/:id — single category.
catalogRouter.get("/categories/:id", async (req: Request, res: Response) => {
  const [row] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, String(req.params.id)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json({ category: toCategory(row) });
});

// PATCH /api/portal/catalog/categories/:id — update; slug re-derives on rename.
catalogRouter.patch("/categories/:id", async (req: Request, res: Response) => {
  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  const id = String(req.params.id);
  const { name, description, image, isActive } = parsed.data;

  const [current] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const slug =
    name !== undefined && name !== current.name
      ? pickUnique(slugify(name), await categorySlugs(id), "category")
      : current.slug;

  const [updated] = await db
    .update(categories)
    .set({
      ...(name !== undefined && { name, slug }),
      ...(description !== undefined && { description }),
      ...(image !== undefined && { image }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date(),
    })
    .where(eq(categories.id, id))
    .returning();
  res.json({ category: toCategory(updated!) });
});

// DELETE /api/portal/catalog/categories/:id — hard delete (cascades to
// professions + all requirement fields under it).
catalogRouter.delete("/categories/:id", async (req: Request, res: Response) => {
  const result = await db
    .delete(categories)
    .where(eq(categories.id, String(req.params.id)))
    .returning({ id: categories.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.status(204).end();
});

// ── Professions ─────────────────────────────────────────────────────────────

// GET /api/portal/catalog/categories/:id/professions — list within a category.
catalogRouter.get(
  "/categories/:id/professions",
  async (req: Request, res: Response) => {
    const categoryId = String(req.params.id);
    const rows = await db
      .select()
      .from(professions)
      .where(eq(professions.categoryId, categoryId))
      .orderBy(asc(professions.position), asc(professions.createdAt));
    res.json({ professions: rows.map(toProfession) });
  },
);

// POST /api/portal/catalog/categories/:id/professions — create within category.
catalogRouter.post(
  "/categories/:id/professions",
  async (req: Request, res: Response) => {
    const parsed = createProfessionSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const categoryId = String(req.params.id);

    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const { name } = parsed.data;
    const slug = pickUnique(
      slugify(name),
      await professionSlugs(categoryId),
      "profession",
    );
    const [posRow] = await db
      .select({ max: sql<number>`coalesce(max(${professions.position}), -1)` })
      .from(professions)
      .where(eq(professions.categoryId, categoryId));

    const [created] = await db
      .insert(professions)
      .values({ categoryId, name, slug, position: (posRow?.max ?? -1) + 1 })
      .returning();
    res.status(201).json({ profession: toProfession(created!) });
  },
);

// PATCH /api/portal/catalog/professions/:id — rename / toggle / reorder.
catalogRouter.patch(
  "/professions/:id",
  async (req: Request, res: Response) => {
    const parsed = updateProfessionSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const id = String(req.params.id);
    const { name, isActive, position } = parsed.data;

    const [current] = await db
      .select()
      .from(professions)
      .where(eq(professions.id, id))
      .limit(1);
    if (!current) {
      res.status(404).json({ error: "Profession not found" });
      return;
    }

    const slug =
      name !== undefined && name !== current.name
        ? pickUnique(
            slugify(name),
            await professionSlugs(current.categoryId, id),
            "profession",
          )
        : current.slug;

    const [updated] = await db
      .update(professions)
      .set({
        ...(name !== undefined && { name, slug }),
        ...(isActive !== undefined && { isActive }),
        ...(position !== undefined && { position }),
        updatedAt: new Date(),
      })
      .where(eq(professions.id, id))
      .returning();
    res.json({ profession: toProfession(updated!) });
  },
);

// DELETE /api/portal/catalog/professions/:id — hard delete (cascades to its
// requirement fields).
catalogRouter.delete(
  "/professions/:id",
  async (req: Request, res: Response) => {
    const result = await db
      .delete(professions)
      .where(eq(professions.id, String(req.params.id)))
      .returning({ id: professions.id });
    if (result.length === 0) {
      res.status(404).json({ error: "Profession not found" });
      return;
    }
    res.status(204).end();
  },
);

// ── Requirement fields ────────────────────────────────────────────────────────

// GET /api/portal/catalog/requirement-fields?level=&categoryId=&professionId=
catalogRouter.get(
  "/requirement-fields",
  async (req: Request, res: Response) => {
    const level = requirementLevelSchema.safeParse(req.query.level);
    if (!level.success) {
      res.status(400).json({ error: "level must be catalog|category|profession" });
      return;
    }
    const categoryId = req.query.categoryId
      ? String(req.query.categoryId)
      : undefined;
    const professionId = req.query.professionId
      ? String(req.query.professionId)
      : undefined;

    if (level.data === "category" && !categoryId) {
      res.status(400).json({ error: "categoryId is required for level=category" });
      return;
    }
    if (level.data === "profession" && !professionId) {
      res
        .status(400)
        .json({ error: "professionId is required for level=profession" });
      return;
    }

    const rows = await db
      .select()
      .from(requirementFields)
      .where(scopeWhere(level.data, categoryId, professionId))
      .orderBy(asc(requirementFields.position), asc(requirementFields.createdAt));
    res.json({ fields: rows.map(toRequirementField) });
  },
);

// POST /api/portal/catalog/requirement-fields — create at any level.
catalogRouter.post(
  "/requirement-fields",
  async (req: Request, res: Response) => {
    const parsed = createRequirementFieldSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const {
      level,
      categoryId,
      professionId,
      label,
      inputType,
      required,
      options,
      allowedFileTypes,
    } = parsed.data;

    // Verify the target exists (FK would catch it, but give a clean 404).
    if (level === "category") {
      const [c] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, categoryId!))
        .limit(1);
      if (!c) {
        res.status(404).json({ error: "Category not found" });
        return;
      }
    } else if (level === "profession") {
      const [p] = await db
        .select({ id: professions.id })
        .from(professions)
        .where(eq(professions.id, professionId!))
        .limit(1);
      if (!p) {
        res.status(404).json({ error: "Profession not found" });
        return;
      }
    }

    const key = pickUnique(
      slugify(label),
      await requirementKeys(level, categoryId, professionId),
      "field",
    );
    const position = await nextRequirementPosition(
      level,
      categoryId,
      professionId,
    );

    const [created] = await db
      .insert(requirementFields)
      .values({
        level,
        categoryId: level === "category" ? categoryId! : null,
        professionId: level === "profession" ? professionId! : null,
        key,
        label,
        inputType,
        required: required ?? false,
        options: inputType === "select" ? (options ?? []) : null,
        allowedFileTypes: inputType === "file" ? (allowedFileTypes ?? []) : null,
        position,
      })
      .returning();
    res.status(201).json({ field: toRequirementField(created!) });
  },
);

// PATCH /api/portal/catalog/requirement-fields/:id — edit (key is immutable).
catalogRouter.patch(
  "/requirement-fields/:id",
  async (req: Request, res: Response) => {
    const parsed = updateRequirementFieldSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const id = String(req.params.id);
    const { label, inputType, required, options, allowedFileTypes, isActive, position } =
      parsed.data;

    const [current] = await db
      .select()
      .from(requirementFields)
      .where(eq(requirementFields.id, id))
      .limit(1);
    if (!current) {
      res.status(404).json({ error: "Requirement field not found" });
      return;
    }

    // The effective type after this update decides which extras are kept.
    const nextType = inputType ?? current.inputType;
    const [updated] = await db
      .update(requirementFields)
      .set({
        ...(label !== undefined && { label }),
        ...(inputType !== undefined && { inputType }),
        ...(required !== undefined && { required }),
        ...(isActive !== undefined && { isActive }),
        ...(position !== undefined && { position }),
        // Keep type-specific extras consistent with the (possibly new) type.
        ...((options !== undefined || inputType !== undefined) && {
          options:
            nextType === "select"
              ? (options ?? current.options ?? [])
              : null,
        }),
        ...((allowedFileTypes !== undefined || inputType !== undefined) && {
          allowedFileTypes:
            nextType === "file"
              ? (allowedFileTypes ?? current.allowedFileTypes ?? [])
              : null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(requirementFields.id, id))
      .returning();
    res.json({ field: toRequirementField(updated!) });
  },
);

// DELETE /api/portal/catalog/requirement-fields/:id — hard delete.
catalogRouter.delete(
  "/requirement-fields/:id",
  async (req: Request, res: Response) => {
    const result = await db
      .delete(requirementFields)
      .where(eq(requirementFields.id, String(req.params.id)))
      .returning({ id: requirementFields.id });
    if (result.length === 0) {
      res.status(404).json({ error: "Requirement field not found" });
      return;
    }
    res.status(204).end();
  },
);

// GET /api/portal/catalog/professions/:id/effective-requirements — the cascaded
// set grouped by source (catalog + the profession's category + the profession).
catalogRouter.get(
  "/professions/:id/effective-requirements",
  async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const [profession] = await db
      .select()
      .from(professions)
      .where(eq(professions.id, id))
      .limit(1);
    if (!profession) {
      res.status(404).json({ error: "Profession not found" });
      return;
    }

    const order = [
      asc(requirementFields.position),
      asc(requirementFields.createdAt),
    ] as const;

    const [catalog, category, own] = await Promise.all([
      db
        .select()
        .from(requirementFields)
        .where(scopeWhere("catalog"))
        .orderBy(...order),
      db
        .select()
        .from(requirementFields)
        .where(scopeWhere("category", profession.categoryId))
        .orderBy(...order),
      db
        .select()
        .from(requirementFields)
        .where(scopeWhere("profession", undefined, id))
        .orderBy(...order),
    ]);

    res.json({
      catalog: catalog.map(toRequirementField),
      category: category.map(toRequirementField),
      profession: own.map(toRequirementField),
    });
  },
);
