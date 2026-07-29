import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import type { WorkerRateRow } from "@odj/shared";
import { signOut } from "@/lib/auth-client";
import { ONBOARDING_STATE_KEY, NOTIFICATIONS_KEY } from "@/lib/app-api";
import { useOnboardingState } from "@/lib/use-onboarding";
import { useWorkerRates } from "@/lib/use-worker";
import { NotificationsList } from "@/components/notifications-list";
import { ThemeToggle } from "@/components/theme-toggle";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StarRating } from "@/components/ui/star-rating";

type StepKey = "rates" | "availability" | "location";

const ITEMS: { key: StepKey; href: Href; emoji: string; title: string; subtitle: string }[] = [
  { key: "rates", href: "/rates", emoji: "💰", title: "Your rates", subtitle: "Set what you charge per profession" },
  { key: "availability", href: "/availability", emoji: "📅", title: "Availability", subtitle: "Mark the days you're not working" },
  { key: "location", href: "/location", emoji: "📍", title: "Location", subtitle: "Update your precise current location" },
];

function isPriced(r: WorkerRateRow): boolean {
  return (
    (r.dailyMin !== null && r.dailyMax !== null) ||
    (r.hourlyMin !== null && r.hourlyMax !== null)
  );
}
function hasRate(r: WorkerRateRow): boolean {
  return r.dailyRate !== null || r.hourlyRate !== null;
}

/** Worker Profile tab — set-up (rates/availability/location) + notifications + account. */
export default function WorkerProfile() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: state } = useOnboardingState();
  const { data: rates } = useWorkerRates();
  const worker = state?.worker;

  const priced = (rates ?? []).filter(isPriced);
  const done: Record<StepKey, boolean> = {
    rates: rates !== undefined && priced.every(hasRate),
    availability: !!worker?.availabilityReviewedAt,
    location: !!worker?.locationCapturedAt,
  };

  async function handleSignOut() {
    await signOut();
    qc.removeQueries({ queryKey: ONBOARDING_STATE_KEY });
    qc.removeQueries({ queryKey: NOTIFICATIONS_KEY });
    router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-5 p-6">
        <Text className="pt-2 text-2xl font-poppins-semibold text-foreground">
          Profile
        </Text>

        <Card className="flex-row items-center justify-between">
          <Text className="font-poppins-medium text-foreground">Your rating</Text>
          <View className="items-end gap-1">
            <StarRating value={Math.round(worker?.avgRating ?? 0)} size="sm" />
            <Text className="text-sm text-muted-foreground">
              {worker?.ratingCount
                ? `${worker.avgRating!.toFixed(1)} (${worker.ratingCount})`
                : "No ratings yet"}
            </Text>
          </View>
        </Card>

        <View className="gap-2">
          <Text className="font-poppins-medium text-foreground">Your setup</Text>
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

        <View className="gap-2">
          <Text className="font-poppins-medium text-foreground">Notifications</Text>
          <NotificationsList />
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-muted-foreground">Theme</Text>
          <ThemeToggle />
        </View>

        <Button variant="ghost" onPress={handleSignOut}>
          <Text>Sign out</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
