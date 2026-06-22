"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import type { Category, Profession } from "@odj/shared";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { RequirementFieldsPanel } from "@/components/requirement-fields-panel";

export function CategoryDetail({ categoryId }: { categoryId: string }) {
  const qc = useQueryClient();
  const catKey = ["catalog", "category", categoryId];
  const profKey = ["catalog", "professions", categoryId];

  const { data: catData, isLoading: catLoading } = useQuery({
    queryKey: catKey,
    queryFn: () =>
      apiFetch<{ category: Category }>(
        `/api/portal/catalog/categories/${categoryId}`,
      ),
  });
  const { data: profData, isLoading: profLoading } = useQuery({
    queryKey: profKey,
    queryFn: () =>
      apiFetch<{ professions: Profession[] }>(
        `/api/portal/catalog/categories/${categoryId}/professions`,
      ),
  });
  const category = catData?.category;
  const professions = profData?.professions ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<Profession | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<Profession | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: profKey });

  const create = useMutation({
    mutationFn: () =>
      apiFetch(`/api/portal/catalog/categories/${categoryId}/professions`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      }),
    onSuccess: () => {
      toast.success("Profession added");
      setCreateOpen(false);
      setName("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rename = useMutation({
    mutationFn: () =>
      apiFetch(`/api/portal/catalog/professions/${renaming!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: renameValue.trim() }),
      }),
    onSuccess: () => {
      toast.success("Profession renamed");
      setRenaming(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (p: Profession) =>
      apiFetch(`/api/portal/catalog/professions/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !p.isActive }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const swap = useMutation({
    mutationFn: async ({ a, b }: { a: Profession; b: Profession }) => {
      await Promise.all([
        apiFetch(`/api/portal/catalog/professions/${a.id}`, {
          method: "PATCH",
          body: JSON.stringify({ position: b.position }),
        }),
        apiFetch(`/api/portal/catalog/professions/${b.id}`, {
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
      apiFetch(`/api/portal/catalog/professions/${deleting!.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Profession removed");
      setDeleting(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/catalog"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Catalog
        </Link>
        {catLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {category?.name ?? "Category"}
            </h1>
            {category && !category.isActive && (
              <Badge variant="outline">Hidden</Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium">Professions</h2>
            <p className="text-sm text-muted-foreground">
              Specific roles in this category. Open one to set its own fields.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setName("");
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" /> New profession
          </Button>
        </div>

        <div className="flex flex-col divide-y rounded-lg border">
          {profLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="p-3">
                <Skeleton className="h-6 w-full" />
              </div>
            ))
          ) : professions.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No professions yet.
            </p>
          ) : (
            professions.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 data-[inactive=true]:opacity-50"
                data-inactive={!p.isActive}
              >
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Move up"
                    disabled={i === 0 || swap.isPending}
                    onClick={() => swap.mutate({ a: p, b: professions[i - 1]! })}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Move down"
                    disabled={i === professions.length - 1 || swap.isPending}
                    onClick={() => swap.mutate({ a: p, b: professions[i + 1]! })}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                </div>

                <Link
                  href={`/catalog/${categoryId}/${p.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{p.name}</span>
                      {!p.isActive && <Badge variant="outline">Hidden</Badge>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      /{p.slug}
                    </span>
                  </span>
                </Link>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleActive.mutate(p)}
                  disabled={toggleActive.isPending}
                >
                  {p.isActive ? "Hide" : "Show"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Rename"
                  onClick={() => {
                    setRenaming(p);
                    setRenameValue(p.name);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete profession"
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
                <Link
                  href={`/catalog/${categoryId}/${p.id}`}
                  aria-label="Open profession"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className="size-4" />
                </Link>
              </div>
            ))
          )}
        </div>
      </div>

      <RequirementFieldsPanel
        level="category"
        categoryId={categoryId}
        title="Category requirements"
        description="Asked of every worker in any profession under this category."
      />

      {/* Create profession */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New profession</DialogTitle>
            <DialogDescription>
              Add a role under {category?.name ?? "this category"}. The slug is
              generated from the name.
            </DialogDescription>
          </DialogHeader>
          <form
            id="profession-form"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
            className="flex flex-col gap-1.5"
          >
            <Label htmlFor="profession-name">Name</Label>
            <Input
              id="profession-name"
              placeholder="e.g. Cab Driver"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="profession-form" disabled={create.isPending}>
              {create.isPending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename profession */}
      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename profession</DialogTitle>
            <DialogDescription>
              The slug will be regenerated from the new name.
            </DialogDescription>
          </DialogHeader>
          <form
            id="rename-form"
            onSubmit={(e) => {
              e.preventDefault();
              rename.mutate();
            }}
            className="flex flex-col gap-1.5"
          >
            <Label htmlFor="rename-name">Name</Label>
            <Input
              id="rename-name"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              required
            />
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button type="submit" form="rename-form" disabled={rename.isPending}>
              {rename.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete profession */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove profession?</DialogTitle>
            <DialogDescription>
              &ldquo;{deleting?.name}&rdquo; and its requirement fields will be
              permanently removed.
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
