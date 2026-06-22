"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { toast } from "sonner";
import {
  createCategorySchema,
  updateCategorySchema,
  type Category,
} from "@odj/shared";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AvatarUploader } from "@/components/avatar-uploader";

const QUERY_KEY = ["catalog", "categories"];

/**
 * Create/edit a category. The icon image reuses the shared Uploadcare uploader
 * (stores the CDN url). `category` null ⇒ create mode. Slug is auto-generated
 * server-side from the name.
 */
export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}) {
  const qc = useQueryClient();
  const editing = !!category;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setImage(category?.image ?? null);
  }, [open, category]);

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const body = updateCategorySchema.parse({
          name: name.trim(),
          description: description.trim() || null,
          image,
        });
        return apiFetch(`/api/portal/catalog/categories/${category!.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      const body = createCategorySchema.parse({
        name: name.trim(),
        description: description.trim() || null,
        image,
      });
      return apiFetch("/api/portal/catalog/categories", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Category updated" : "Category created");
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't save the category"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>
            A category groups professions (e.g. Driver → Cab Driver). The slug is
            generated from the name.
          </DialogDescription>
        </DialogHeader>

        <form
          id="category-form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              placeholder="e.g. Driver"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-description">Description (optional)</Label>
            <Textarea
              id="category-description"
              placeholder="Short summary of this category"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Icon</Label>
            {image && (
              <div className="flex items-center gap-3">
                <Image
                  src={image}
                  alt=""
                  width={48}
                  height={48}
                  className="size-12 rounded-lg border object-cover"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setImage(null)}
                >
                  Remove
                </Button>
              </div>
            )}
            <AvatarUploader onChange={setImage} />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" disabled={save.isPending}>
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
