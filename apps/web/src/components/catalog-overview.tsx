"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Boxes, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@odj/shared";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryFormDialog } from "@/components/category-form-dialog";
import { RequirementFieldsPanel } from "@/components/requirement-fields-panel";

const QUERY_KEY = ["catalog", "categories"];

/** Catalog landing: global (all-worker) requirements + the categories grid. */
export function CatalogOverview() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      apiFetch<{ categories: Category[] }>("/api/portal/catalog/categories"),
  });
  const categories = data?.categories ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const remove = useMutation({
    mutationFn: () =>
      apiFetch(`/api/portal/catalog/categories/${deleting!.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Category deleted");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Define the categories and professions workers sign up under, and the
          information they must provide.
        </p>
      </div>

      <RequirementFieldsPanel
        level="catalog"
        title="Global requirements (all workers)"
        description="Asked of every worker, in every profession, after their basic info."
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Categories</h2>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> New category
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No categories yet. Create one to start adding professions.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <div
                key={c.id}
                className="group relative flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:border-primary/40 data-[inactive=true]:opacity-60"
                data-inactive={!c.isActive}
              >
                <Link
                  href={`/catalog/${c.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    {c.image ? (
                      <Image
                        src={c.image}
                        alt=""
                        width={44}
                        height={44}
                        className="size-11 object-cover"
                      />
                    ) : (
                      <Boxes className="size-5 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.name}</span>
                      {!c.isActive && <Badge variant="outline">Hidden</Badge>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      /{c.slug}
                    </span>
                  </span>
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon" aria-label="Category actions">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditing(c);
                        setFormOpen(true);
                      }}
                    >
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleting(c)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editing}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              &ldquo;{deleting?.name}&rdquo; and all its professions and
              requirement fields will be permanently removed.
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
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
