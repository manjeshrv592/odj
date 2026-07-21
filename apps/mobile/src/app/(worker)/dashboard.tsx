import { View, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { WorkerRateRow } from "@odj/shared";
import { appApi, ONBOARDING_STATE_KEY } from "@/lib/app-api";
import { useOnboardingState } from "@/lib/use-onboarding";
import { useWorkerRates } from "@/lib/use-worker";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

type StepKey = "rates" | "availability" | "location";
type HubItem = { key: StepKey; href: Href; emoji: string; title: string; subtitle: string };

// Route-group segments — like (worker) — are stripped from the URL, so the hrefs
// are the bare paths (/rates, not /(worker)/rates).
const ITEMS: HubItem[] = [
  {
    key: "rates",
    href: "/rates",
    emoji: "💰",
    title: "Your rates",
    subtitle: "Set what you charge per profession",
  },
  {
    key: "availability",
    href: "/availability",
    emoji: "📅",
    title: "Availability",
    subtitle: "Mark the days you're not working (optional)",
  },
  {
    key: "location",
    href: "/location",
    emoji: "📍",
    title: "Location",
    subtitle: "Update your precise current location",
  },
];

/** A profession is "priced" if the admin enabled at least one unit for it. */
function isPriced(r: WorkerRateRow): boolean {
  return (
    (r.dailyMin !== null && r.dailyMax !== null) ||
    (r.hourlyMin !== null && r.hourlyMax !== null)
  );
}
/** True once the worker has set at least one rate for a priced profession. */
function hasRate(r: WorkerRateRow): boolean {
  return r.dailyRate !== null || r.hourlyRate !== null;
}

/** Hub the approved worker lands on from the verified home; opens each setup area. */
export default function WorkerDashboard() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: state } = useOnboardingState();
  const { data: rates } = useWorkerRates();
  const worker = state?.worker;

  // Per-step completion. Rates: every priced profession has a rate (vacuously true
  // when none are priced yet). Availability: acknowledged. Location: captured.
  const priced = (rates ?? []).filter(isPriced);
  const done: Record<StepKey, boolean> = {
    rates: rates !== undefined && priced.every(hasRate),
    availability: !!worker?.availabilityReviewedAt,
    location: !!worker?.locationCapturedAt,
  };
  // Availability is optional; only rates + location are required to "finish".
  const requiredDone = done.rates && done.location;

  const finish = useMutation({
    mutationFn: appApi.completeSetup,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ONBOARDING_STATE_KEY });
      router.replace("/home");
    },
    onError: (e: Error) => Alert.alert("Something went wrong", e.message),
  });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-5 p-6">
        <View className="gap-1 pt-2">
          <Text className="text-2xl font-poppins-semibold text-foreground">
            Worker dashboard
          </Text>
          <Text className="text-muted-foreground">
            Keep these up to date so hirers can find and book you.
          </Text>
        </View>

        <View className="gap-3">
          {ITEMS.map((item) => (
            <Button
              key={item.key}
              variant="outline"
              className="h-auto items-center justify-start gap-4 p-4"
              onPress={() => router.push(item.href)}
            >
              <Text className="text-3xl">{item.emoji}</Text>
              <View className="flex-1">
                <Text className="font-poppins-medium text-foreground">
                  {item.title}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {item.subtitle}
                </Text>
              </View>
              {done[item.key] ? (
                <Text className="text-xl text-primary">✓</Text>
              ) : (
                <Text className="text-2xl text-muted-foreground">›</Text>
              )}
            </Button>
          ))}
        </View>
      </ScrollView>

      <View className="gap-2 p-6">
        <Button onPress={() => finish.mutate()} disabled={finish.isPending}>
          {finish.isPending ? (
            <ActivityIndicator />
          ) : (
            <Text>{requiredDone ? "Finish" : "Skip for now"}</Text>
          )}
        </Button>
      </View>
    </SafeAreaView>
  );
}
