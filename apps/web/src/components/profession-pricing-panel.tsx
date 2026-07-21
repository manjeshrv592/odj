"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Profession, UpdateProfessionPricing } from "@odj/shared";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UnitKey = "daily" | "hourly";

const UNITS: { key: UnitKey; label: string; hint: string }[] = [
  { key: "daily", label: "Daily rate (₹/day)", hint: "Per full day of work" },
  { key: "hourly", label: "Hourly rate (₹/hour)", hint: "Per hour of work" },
];

/** Empty string ⇒ null; otherwise the parsed non-negative integer (NaN ⇒ null). */
function parseRupees(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * Admin price bounds for one profession (INR whole rupees). Each unit (daily /
 * hourly) is both-or-neither — set min + max to offer it, clear both to disable
 * it. Validates `min ≤ max` client-side; the server re-validates. Workers can
 * only set a rate for a unit that has bounds here.
 */
export function ProfessionPricingPanel({
  professionId,
  profession,
}: {
  professionId: string;
  profession?: Profession;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({
    dailyMin: "",
    dailyMax: "",
    hourlyMin: "",
    hourlyMax: "",
  });

  // Seed from the loaded profession once it arrives.
  useEffect(() => {
    if (!profession) return;
    setForm({
      dailyMin: profession.dailyMin?.toString() ?? "",
      dailyMax: profession.dailyMax?.toString() ?? "",
      hourlyMin: profession.hourlyMin?.toString() ?? "",
      hourlyMax: profession.hourlyMax?.toString() ?? "",
    });
  }, [profession]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Per-unit validation: both-or-neither + min ≤ max.
  const unitError = (unit: UnitKey): string | null => {
    const min = parseRupees(form[`${unit}Min`]!);
    const max = parseRupees(form[`${unit}Max`]!);
    const minEmpty = form[`${unit}Min`]!.trim() === "";
    const maxEmpty = form[`${unit}Max`]!.trim() === "";
    if (minEmpty !== maxEmpty) return "Set both min and max, or clear both";
    if (!minEmpty && (min === null || max === null)) return "Enter whole rupees ≥ 0";
    if (min !== null && max !== null && min > max) return "Max must be ≥ min";
    return null;
  };

  const errors = { daily: unitError("daily"), hourly: unitError("hourly") };
  const hasError = !!errors.daily || !!errors.hourly;

  const save = useMutation({
    mutationFn: () => {
      const body: UpdateProfessionPricing = {
        dailyMin: parseRupees(form.dailyMin!),
        dailyMax: parseRupees(form.dailyMax!),
        hourlyMin: parseRupees(form.hourlyMin!),
        hourlyMax: parseRupees(form.hourlyMax!),
      };
      return apiFetch(`/api/portal/catalog/professions/${professionId}/pricing`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success("Price bounds saved");
      qc.invalidateQueries({ queryKey: ["catalog", "profession", professionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4 rounded-2xl border p-4">
      <div>
        <h2 className="font-medium">Price bounds (INR)</h2>
        <p className="text-sm text-muted-foreground">
          The min/max a worker may charge for this profession. Set both min and
          max to offer a unit; clear both to disable it.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {UNITS.map(({ key, label, hint }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <Label className="text-sm">{label}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Min"
                value={form[`${key}Min`]}
                onChange={set(`${key}Min`)}
                aria-label={`${key} min`}
                className="max-w-32"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Max"
                value={form[`${key}Max`]}
                onChange={set(`${key}Max`)}
                aria-label={`${key} max`}
                className="max-w-32"
              />
            </div>
            {errors[key] ? (
              <p className="text-xs text-destructive">{errors[key]}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{hint}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => save.mutate()}
          disabled={hasError || save.isPending}
        >
          {save.isPending ? "Saving…" : "Save price bounds"}
        </Button>
      </div>
    </div>
  );
}
