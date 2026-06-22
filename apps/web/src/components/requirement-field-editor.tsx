"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  slugify,
  createRequirementFieldSchema,
  updateRequirementFieldSchema,
  type RequirementField,
  type RequirementLevel,
  type RequirementInputType,
  type AllowedFileType,
} from "@odj/shared";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TYPE_LABELS: Record<RequirementInputType, string> = {
  text: "Text",
  file: "File upload",
  select: "Dropdown",
};

const FILE_TYPES: AllowedFileType[] = ["pdf", "jpg", "jpeg", "png"];

type Scope = {
  level: RequirementLevel;
  categoryId?: string;
  professionId?: string;
  /** Query key the parent panel uses, so we invalidate the right list. */
  queryKey: readonly unknown[];
};

/**
 * Create/edit dialog for a single requirement field. Switches its inputs by the
 * chosen type: a dropdown gets an options editor, a file upload gets file-type
 * checkboxes. On save it POSTs (create) or PATCHes (edit) and invalidates the
 * owning panel's query. `field` null ⇒ create mode.
 */
export function RequirementFieldEditor({
  open,
  onOpenChange,
  scope,
  field,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: Scope;
  field: RequirementField | null;
}) {
  const qc = useQueryClient();
  const editing = !!field;

  const [label, setLabel] = useState("");
  const [inputType, setInputType] = useState<RequirementInputType>("text");
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<string[]>([""]);
  const [fileTypes, setFileTypes] = useState<AllowedFileType[]>(["pdf"]);

  // Reset the form whenever the dialog opens (for the field being edited/created).
  useEffect(() => {
    if (!open) return;
    setLabel(field?.label ?? "");
    setInputType(field?.inputType ?? "text");
    setRequired(field?.required ?? false);
    setOptions(
      field?.options?.length ? field.options.map((o) => o.label) : [""],
    );
    setFileTypes(field?.allowedFileTypes?.length ? field.allowedFileTypes : ["pdf"]);
  }, [open, field]);

  const save = useMutation({
    mutationFn: async () => {
      const cleanOptions = options
        .map((o) => o.trim())
        .filter(Boolean)
        .map((text, i) => ({ value: slugify(text) || `option-${i + 1}`, label: text }));

      if (editing) {
        const body = updateRequirementFieldSchema.parse({
          label: label.trim(),
          inputType,
          required,
          ...(inputType === "select" && { options: cleanOptions }),
          ...(inputType === "file" && { allowedFileTypes: fileTypes }),
        });
        return apiFetch(`/api/portal/catalog/requirement-fields/${field!.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }

      const body = createRequirementFieldSchema.parse({
        level: scope.level,
        ...(scope.categoryId && { categoryId: scope.categoryId }),
        ...(scope.professionId && { professionId: scope.professionId }),
        label: label.trim(),
        inputType,
        required,
        ...(inputType === "select" && { options: cleanOptions }),
        ...(inputType === "file" && { allowedFileTypes: fileTypes }),
      });
      return apiFetch("/api/portal/catalog/requirement-fields", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Field updated" : "Field added");
      qc.invalidateQueries({ queryKey: scope.queryKey });
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast.error(
        // zod parse errors surface as a long string; keep it readable.
        e.message.includes("option")
          ? "Add at least one option"
          : e.message.includes("file type")
            ? "Pick at least one file type"
            : e.message || "Couldn't save the field",
      ),
  });

  function toggleFileType(t: AllowedFileType) {
    setFileTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit field" : "Add requirement field"}</DialogTitle>
          <DialogDescription>
            The question a worker answers. Choose how they respond.
          </DialogDescription>
        </DialogHeader>

        <form
          id="field-form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="field-label">Question / label</Label>
            <Input
              id="field-label"
              placeholder="e.g. Driving licence number"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Answer type</Label>
            <Select
              value={inputType}
              onValueChange={(v) => setInputType(v as RequirementInputType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => TYPE_LABELS[v as RequirementInputType]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="file">File upload</SelectItem>
                <SelectItem value="select">Dropdown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {inputType === "select" && (
            <div className="flex flex-col gap-2">
              <Label>Options</Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((o, j) => (j === i ? e.target.value : o)),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove option"
                    disabled={options.length === 1}
                    onClick={() =>
                      setOptions((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => setOptions((prev) => [...prev, ""])}
              >
                <Plus className="size-4" /> Add option
              </Button>
            </div>
          )}

          {inputType === "file" && (
            <div className="flex flex-col gap-2">
              <Label>Allowed file types</Label>
              <div className="flex flex-wrap gap-4">
                {FILE_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={fileTypes.includes(t)}
                      onCheckedChange={() => toggleFileType(t)}
                    />
                    <span className="uppercase">{t}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
            <span className="flex flex-col">
              <span className="text-sm font-medium">Required</span>
              <span className="text-xs text-muted-foreground">
                Workers must answer this to continue.
              </span>
            </span>
            <Switch checked={required} onCheckedChange={(v) => setRequired(v)} />
          </label>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="field-form" disabled={save.isPending}>
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Add field"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
