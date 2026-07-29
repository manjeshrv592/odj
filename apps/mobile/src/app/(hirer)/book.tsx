import * as React from "react";
import { View, ScrollView, ActivityIndicator, Alert, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  MAX_QUANTITY,
  formatPaise,
  rupeesToPaise,
  type RateUnit,
} from "@odj/shared";
import { appApi } from "@/lib/app-api";
import { useSession } from "@/lib/auth-client";
import { useOnboardingState } from "@/lib/use-onboarding";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";

const UNIT_LABEL: Record<RateUnit, { one: string; many: string }> = {
  daily: { one: "day", many: "days" },
  hourly: { one: "hour", many: "hours" },
};

/** A −/+ stepper. Bounds come from `MAX_QUANTITY`, so it can't produce a value
 *  the server's `createJobSchema` would reject. */
function QuantityStepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const step = (delta: number) => {
    const next = value + delta;
    if (next >= 1 && next <= max) onChange(next);
  };
  return (
    <View className="flex-row items-center justify-between rounded-xl bg-secondary p-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        disabled={value <= 1}
        onPress={() => step(-1)}
        className="h-11 w-11 items-center justify-center rounded-lg bg-background disabled:opacity-40"
      >
        <Text className="text-xl font-poppins-medium text-foreground">−</Text>
      </Pressable>
      <Text className="text-lg font-poppins-semibold text-foreground">{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase"
        disabled={value >= max}
        onPress={() => step(1)}
        className="h-11 w-11 items-center justify-center rounded-lg bg-background disabled:opacity-40"
      >
        <Text className="text-xl font-poppins-medium text-foreground">+</Text>
      </Pressable>
    </View>
  );
}

/**
 * Hirer step 3 — fix how the job is priced before searching.
 *
 * The exact amount can't be shown yet: every worker sets their own rate, so all
 * we can quote here is the range the admin allows for this profession. The real
 * amount is snapshotted server-side when a worker accepts.
 */
export default function HirerBook() {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: state } = useOnboardingState();
  const params = useLocalSearchParams<{
    categoryId: string;
    professionId: string;
    professionName?: string;
  }>();

  // Same query key as the professions list — served straight from cache.
  const { data: professions, isLoading } = useQuery({
    queryKey: ["catalog", "professions", params.categoryId],
    queryFn: () => appApi.professions(params.categoryId),
    enabled: !!session?.user && !!params.categoryId,
  });
  const profession = professions?.find((p) => p.id === params.professionId);

  // A unit is offered only when the admin set both of its bounds.
  const units = React.useMemo<RateUnit[]>(() => {
    if (!profession) return [];
    const out: RateUnit[] = [];
    if (profession.dailyMin !== null && profession.dailyMax !== null) out.push("daily");
    if (profession.hourlyMin !== null && profession.hourlyMax !== null) out.push("hourly");
    return out;
  }, [profession]);

  const [unit, setUnit] = React.useState<RateUnit | null>(null);
  const [quantity, setQuantity] = React.useState(1);

  // Default to the first offered unit once the profession loads.
  React.useEffect(() => {
    if (unit === null && units.length > 0) setUnit(units[0]!);
  }, [units, unit]);

  const bounds =
    profession && unit
      ? unit === "daily"
        ? { min: profession.dailyMin, max: profession.dailyMax }
        : { min: profession.hourlyMin, max: profession.hourlyMax }
      : null;

  const start = useMutation({
    mutationFn: () => {
      const lat = state?.hirer?.lat;
      const lng = state?.hirer?.lng;
      if (lat == null || lng == null) {
        throw new Error(
          "Your location isn't set. Please update it in your profile first.",
        );
      }
      if (!unit) throw new Error("Pick how you want to be charged.");
      return appApi.createJob({
        professionId: params.professionId,
        lat,
        lng,
        rateUnit: unit,
        quantity,
      });
    },
    onSuccess: (job) => router.push(`/(hirer)/search?jobId=${job.id}` as Href),
    onError: (e: Error) => Alert.alert("Couldn't start search", e.message),
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!profession || units.length === 0 || !unit) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center gap-3 p-6">
          <Text className="text-lg font-poppins-semibold text-foreground">
            Not bookable yet
          </Text>
          <Text className="text-muted-foreground">
            {profession?.name ?? "This profession"} doesn&apos;t have pricing set up
            yet. Please try another one.
          </Text>
          <Button variant="outline" onPress={() => router.back()}>
            <Text>← Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const label = UNIT_LABEL[unit];
  const max = MAX_QUANTITY[unit];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 p-6">
        <View className="gap-1 pt-2">
          <Text className="text-2xl font-poppins-semibold text-foreground">
            {profession.name}
          </Text>
          <Text className="text-muted-foreground">
            How long do you need them for?
          </Text>
        </View>

        {units.length > 1 && (
          <View className="gap-2">
            <Text className="font-poppins-medium text-foreground">Charge by</Text>
            <Segmented
              value={unit}
              onChange={(u) => {
                setUnit(u);
                // Clamp — 12 h is valid, 12 days is too if max allows, but
                // switching units can otherwise leave an out-of-range value.
                setQuantity((q) => Math.min(q, MAX_QUANTITY[u]));
              }}
              options={units.map((u) => ({
                value: u,
                label: u === "daily" ? "Per day" : "Per hour",
              }))}
            />
          </View>
        )}

        <View className="gap-2">
          <Text className="font-poppins-medium text-foreground">
            Number of {label.many}
          </Text>
          <QuantityStepper value={quantity} max={max} onChange={setQuantity} />
          <Text className="text-xs text-muted-foreground">
            Up to {max} {label.many} per booking.
          </Text>
        </View>

        {bounds?.min != null && bounds.max != null && (
          <Card className="gap-1 p-4">
            <Text className="font-poppins-medium text-foreground">
              Estimated total
            </Text>
            <Text className="text-2xl font-poppins-semibold text-foreground">
              {formatPaise(rupeesToPaise(bounds.min) * quantity)} –{" "}
              {formatPaise(rupeesToPaise(bounds.max) * quantity)}
            </Text>
            <Text className="text-xs text-muted-foreground">
              Each worker sets their own rate within this range. You&apos;ll see the
              exact amount as soon as one accepts, and you only pay after the job
              is complete.
            </Text>
          </Card>
        )}
      </ScrollView>

      <View className="gap-2 p-6">
        <Button disabled={start.isPending} onPress={() => start.mutate()}>
          {start.isPending ? (
            <ActivityIndicator />
          ) : (
            <Text>
              Find a {profession.name} for {quantity}{" "}
              {quantity === 1 ? label.one : label.many}
            </Text>
          )}
        </Button>
        <Button variant="ghost" onPress={() => router.back()}>
          <Text className="text-muted-foreground">← Back</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
