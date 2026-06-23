import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { RequirementField } from "@odj/shared";
import { db } from "../db";
import { professions, requirementFields } from "../db/schema";

/**
 * Cascading worker requirement fields — shared by the mobile onboarding API
 * (`routes/app.ts`) and the admin verification detail view (`routes/verifications.ts`).
 */

/** Project a `requirement_fields` row to the shared `RequirementField` shape. */
export function toRequirementField(
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
export async function effectiveFieldsForProfessions(
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
