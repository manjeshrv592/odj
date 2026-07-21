import * as React from "react";
import { View, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Slider from "@react-native-community/slider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { WorkerRateRow } from "@odj/shared";
import { appApi, WORKER_RATES_KEY } from "@/lib/app-api";
import { useWorkerRates } from "@/lib/use-worker";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

type UnitForm = { daily: string; hourly: string };

/** Empty ⇒ null; otherwise the parsed non-negative integer, or NaN if invalid. */
function parseRupees(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

/** Validate one entered rate against its bounds. Returns an error string or null. */
function rateError(
  raw: string,
  min: number | null,
  max: number | null,
): string | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = parseRupees(raw);
  if (n === null || Number.isNaN(n)) return "Enter whole rupees";
  if (min !== null && max !== null && (n < min || n > max)) {
    return `Must be ₹${min}–₹${max}`;
  }
  return null;
}

function RateUnitField({
  label,
  min,
  max,
  value,
  onChangeText,
}: {
  label: string;
  min: number | null;
  max: number | null;
  value: string;
  onChangeText: (t: string) => void;
}) {
  if (min === null || max === null) return null;
  const error = rateError(value, min, max);
  // The slider reflects a valid in-range value; fall back to `min` while the
  // field is empty/invalid so the thumb has a sensible position.
  const parsed = parseRupees(value);
  const sliderValue =
    parsed !== null && !Number.isNaN(parsed)
      ? Math.min(Math.max(parsed, min), max)
      : min;
  return (
    <Field label={label} error={error} hint={`Allowed: ₹${min}–₹${max}`}>
      <Input
        keyboardType="number-pad"
        inputMode="numeric"
        placeholder={`${min}`}
        value={value}
        onChangeText={onChangeText}
      />
      <View className="flex-row items-center gap-3">
        <Text className="w-14 text-xs text-muted-foreground">₹{min}</Text>
        <Slider
          style={{ flex: 1 }}
          minimumValue={min}
          maximumValue={max}
          step={1}
          value={sliderValue}
          onValueChange={(v) => onChangeText(String(Math.round(v)))}
          minimumTrackTintColor="#2563eb"
          thumbTintColor="#2563eb"
        />
        <Text className="w-14 text-right text-xs text-muted-foreground">
          ₹{max}
        </Text>
      </View>
    </Field>
  );
}

export default function WorkerRatesScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: rates, isLoading, isError, error } = useWorkerRates();

  const [form, setForm] = React.useState<Record<string, UnitForm>>({});

  // Seed local form once from the server values.
  React.useEffect(() => {
    if (!rates) return;
    setForm((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const seeded: Record<string, UnitForm> = {};
      for (const r of rates) {
        seeded[r.professionId] = {
          daily: r.dailyRate?.toString() ?? "",
          hourly: r.hourlyRate?.toString() ?? "",
        };
      }
      return seeded;
    });
  }, [rates]);

  const setUnit = (pid: string, unit: keyof UnitForm, v: string) =>
    setForm((f) => {
      const prev = f[pid] ?? { daily: "", hourly: "" };
      return { ...f, [pid]: { ...prev, [unit]: v } };
    });

  const hasError = (rates ?? []).some((r) => {
    const f = form[r.professionId];
    if (!f) return false;
    return (
      !!rateError(f.daily, r.dailyMin, r.dailyMax) ||
      !!rateError(f.hourly, r.hourlyMin, r.hourlyMax)
    );
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = (rates ?? []).map((r) => {
        const f = form[r.professionId] ?? { daily: "", hourly: "" };
        const daily = parseRupees(f.daily);
        const hourly = parseRupees(f.hourly);
        return {
          professionId: r.professionId,
          dailyRate: daily === null || Number.isNaN(daily) ? null : daily,
          hourlyRate: hourly === null || Number.isNaN(hourly) ? null : hourly,
        };
      });
      return appApi.saveWorkerRates(payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: WORKER_RATES_KEY });
      Alert.alert("Saved", "Your rates have been updated.");
      router.back();
    },
    onError: (e: Error) => Alert.alert("Couldn't save", e.message),
  });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-5 p-6">
        <View className="gap-1 pt-2">
          <Text className="text-2xl font-poppins-semibold text-foreground">
            Your rates
          </Text>
          <Text className="text-muted-foreground">
            Set what you charge per profession. Rates must stay within the
            platform&apos;s allowed range.
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator className="mt-8" />
        ) : isError ? (
          <Text className="text-destructive">
            {(error as Error)?.message ?? "Couldn't load your rates."}
          </Text>
        ) : (rates ?? []).length === 0 ? (
          <Text className="text-muted-foreground">
            No professions on your profile yet.
          </Text>
        ) : (
          (rates ?? []).map((r: WorkerRateRow) => {
            const f = form[r.professionId] ?? { daily: "", hourly: "" };
            const noUnits =
              (r.dailyMin === null || r.dailyMax === null) &&
              (r.hourlyMin === null || r.hourlyMax === null);
            return (
              <Card key={r.professionId} className="gap-4">
                <Text className="font-poppins-medium text-foreground">
                  {r.name}
                </Text>
                {noUnits ? (
                  <Text className="text-sm text-muted-foreground">
                    Pricing isn&apos;t available for this profession yet.
                  </Text>
                ) : (
                  <>
                    <RateUnitField
                      label="Daily rate (₹/day)"
                      min={r.dailyMin}
                      max={r.dailyMax}
                      value={f.daily}
                      onChangeText={(v) => setUnit(r.professionId, "daily", v)}
                    />
                    <RateUnitField
                      label="Hourly rate (₹/hour)"
                      min={r.hourlyMin}
                      max={r.hourlyMax}
                      value={f.hourly}
                      onChangeText={(v) => setUnit(r.professionId, "hourly", v)}
                    />
                  </>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      <View className="gap-2 p-6">
        <Button
          onPress={() => save.mutate()}
          disabled={hasError || save.isPending || isLoading}
        >
          {save.isPending ? <ActivityIndicator /> : <Text>Save rates</Text>}
        </Button>
        <Button variant="ghost" onPress={() => router.back()}>
          <Text>Cancel</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
