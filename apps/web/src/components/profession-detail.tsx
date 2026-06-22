"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Type, Upload, List, Lock } from "lucide-react";
import type {
  Category,
  Profession,
  RequirementField,
  EffectiveRequirements,
  RequirementInputType,
} from "@odj/shared";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RequirementFieldsPanel } from "@/components/requirement-fields-panel";

const TYPE_META: Record<
  RequirementInputType,
  { label: string; icon: typeof Type }
> = {
  text: { label: "Text", icon: Type },
  file: { label: "File", icon: Upload },
  select: { label: "Dropdown", icon: List },
};

/** A read-only row for an inherited (catalog/category) field. */
function InheritedRow({ field }: { field: RequirementField }) {
  const Meta = TYPE_META[field.inputType];
  return (
    <div
      className="flex items-center gap-3 p-3 data-[inactive=true]:opacity-50"
      data-inactive={!field.isActive}
    >
      <Lock className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{field.label}</span>
          {field.required && <Badge variant="secondary">Required</Badge>}
          {!field.isActive && <Badge variant="outline">Hidden</Badge>}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Meta.icon className="size-3.5" />
          <span>{Meta.label}</span>
        </div>
      </div>
    </div>
  );
}

function InheritedGroup({
  heading,
  fields,
}: {
  heading: string;
  fields: RequirementField[];
}) {
  if (fields.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {heading}
      </p>
      <div className="flex flex-col divide-y rounded-lg border bg-muted/30">
        {fields.map((f) => (
          <InheritedRow key={f.id} field={f} />
        ))}
      </div>
    </div>
  );
}

export function ProfessionDetail({
  categoryId,
  professionId,
}: {
  categoryId: string;
  professionId: string;
}) {
  const { data: profData, isLoading: profLoading } = useQuery({
    queryKey: ["catalog", "profession", professionId],
    queryFn: () =>
      apiFetch<{ professions: Profession[] }>(
        `/api/portal/catalog/categories/${categoryId}/professions`,
      ).then((r) => ({
        profession: r.professions.find((p) => p.id === professionId) ?? null,
      })),
  });
  const { data: catData } = useQuery({
    queryKey: ["catalog", "category", categoryId],
    queryFn: () =>
      apiFetch<{ category: Category }>(
        `/api/portal/catalog/categories/${categoryId}`,
      ),
  });
  const { data: effective, isLoading: effLoading } = useQuery({
    queryKey: ["catalog", "profession-effective", professionId],
    queryFn: () =>
      apiFetch<EffectiveRequirements>(
        `/api/portal/catalog/professions/${professionId}/effective-requirements`,
      ),
  });

  const profession = profData?.profession;
  const categoryName = catData?.category.name ?? "Category";

  const inheritedCount =
    (effective?.catalog.length ?? 0) + (effective?.category.length ?? 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/catalog" className="hover:text-foreground">
            Catalog
          </Link>
          <ChevronLeft className="size-3 rotate-180" />
          <Link href={`/catalog/${categoryId}`} className="hover:text-foreground">
            {categoryName}
          </Link>
        </nav>
        {profLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <h1 className="text-2xl font-semibold tracking-tight">
            {profession?.name ?? "Profession"}
          </h1>
        )}
      </div>

      {/* Inherited (read-only) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed p-4">
        <div>
          <h2 className="font-medium">Inherited fields</h2>
          <p className="text-sm text-muted-foreground">
            Applied automatically from the catalog and this category. Edit them at
            their own level.
          </p>
        </div>
        {effLoading ? (
          <Skeleton className="h-16 w-full rounded-lg" />
        ) : inheritedCount === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nothing inherited yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <InheritedGroup
              heading="From Catalog (all workers)"
              fields={effective?.catalog ?? []}
            />
            <InheritedGroup
              heading={`From ${categoryName}`}
              fields={effective?.category ?? []}
            />
          </div>
        )}
      </div>

      <RequirementFieldsPanel
        level="profession"
        professionId={professionId}
        title="This profession's fields"
        description="Asked only of workers signing up for this profession."
      />
    </div>
  );
}
