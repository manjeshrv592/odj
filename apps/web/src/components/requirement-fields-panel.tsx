"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Type,
  Upload,
  List,
} from "lucide-react";
import { toast } from "sonner";
import type {
  RequirementField,
  RequirementLevel,
  RequirementInputType,
} from "@odj/shared";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequirementFieldEditor } from "@/components/requirement-field-editor";

const TYPE_META: Record<
  RequirementInputType,
  { label: string; icon: typeof Type }
> = {
  text: { label: "Text", icon: Type },
  file: { label: "File", icon: Upload },
  select: { label: "Dropdown", icon: List },
};

/**
 * Reusable CRUD list for the requirement fields at one scope (catalog, a
 * category, or a profession). Add / edit / delete / activate-toggle / reorder
 * (up-down). Used at all three cascade levels.
 */
export function RequirementFieldsPanel({
  level,
  categoryId,
  professionId,
  title,
  description,
}: {
  level: RequirementLevel;
  categoryId?: string;
  professionId?: string;
  title: string;
  description: string;
}) {
  const qc = useQueryClient();
  const queryKey = useMemo(
    () => ["catalog", "requirement-fields", level, categoryId ?? professionId ?? "root"],
    [level, categoryId, professionId],
  );

  const params = new URLSearchParams({ level });
  if (categoryId) params.set("categoryId", categoryId);
  if (professionId) params.set("professionId", professionId);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      apiFetch<{ fields: RequirementField[] }>(
        `/api/portal/catalog/requirement-fields?${params.toString()}`,
      ),
  });
  const fields = data?.fields ?? [];

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<RequirementField | null>(null);
  const [deleting, setDeleting] = useState<RequirementField | null>(null);

  const scope = { level, categoryId, professionId, queryKey };

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const toggleActive = useMutation({
    mutationFn: (f: RequirementField) =>
      apiFetch(`/api/portal/catalog/requirement-fields/${f.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !f.isActive }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  // Reorder by swapping the `position` of two adjacent fields.
  const swap = useMutation({
    mutationFn: async ({ a, b }: { a: RequirementField; b: RequirementField }) => {
      await Promise.all([
        apiFetch(`/api/portal/catalog/requirement-fields/${a.id}`, {
          method: "PATCH",
          body: JSON.stringify({ position: b.position }),
        }),
        apiFetch(`/api/portal/catalog/requirement-fields/${b.id}`, {
          method: "PATCH",
          body: JSON.stringify({ position: a.position }),
        }),
      ]);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () =>
      apiFetch(`/api/portal/catalog/requirement-fields/${deleting!.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Field removed");
      setDeleting(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(f: RequirementField) {
    setEditing(f);
    setEditorOpen(true);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" /> Add field
        </Button>
      </div>

      <div className="flex flex-col divide-y rounded-lg border">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="p-3">
              <Skeleton className="h-6 w-full" />
            </div>
          ))
        ) : fields.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No fields yet.
          </p>
        ) : (
          fields.map((f, i) => {
            const Meta = TYPE_META[f.inputType];
            return (
              <div
                key={f.id}
                className="flex items-center gap-3 p-3 data-[inactive=true]:opacity-50"
                data-inactive={!f.isActive}
              >
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Move up"
                    disabled={i === 0 || swap.isPending}
                    onClick={() => swap.mutate({ a: f, b: fields[i - 1]! })}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Move down"
                    disabled={i === fields.length - 1 || swap.isPending}
                    onClick={() => swap.mutate({ a: f, b: fields[i + 1]! })}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{f.label}</span>
                    {f.required && (
                      <Badge variant="secondary" className="shrink-0">
                        Required
                      </Badge>
                    )}
                    {!f.isActive && (
                      <Badge variant="outline" className="shrink-0">
                        Hidden
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Meta.icon className="size-3.5" />
                    <span>{Meta.label}</span>
                    {f.inputType === "select" && f.options && (
                      <span>· {f.options.map((o) => o.label).join(", ")}</span>
                    )}
                    {f.inputType === "file" && f.allowedFileTypes && (
                      <span>· {f.allowedFileTypes.join(", ").toUpperCase()}</span>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleActive.mutate(f)}
                  disabled={toggleActive.isPending}
                >
                  {f.isActive ? "Hide" : "Show"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edit field"
                  onClick={() => openEdit(f)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete field"
                  onClick={() => setDeleting(f)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            );
          })
        )}
      </div>

      <RequirementFieldEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        scope={scope}
        field={editing}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove field?</DialogTitle>
            <DialogDescription>
              &ldquo;{deleting?.label}&rdquo; will be removed. This can&apos;t be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
