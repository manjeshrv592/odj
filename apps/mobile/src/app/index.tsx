import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/auth-client";
import { ONBOARDING_STATE_KEY, NOTIFICATIONS_KEY } from "@/lib/app-api";
import { useOnboardingState } from "@/lib/use-onboarding";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsList } from "@/components/notifications-list";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

/**
 * Home for an approved worker/hirer. A verified **worker** continues into the
 * worker dashboard (rates/availability/location); a verified **hirer** can start
 * searching for a worker.
 */
export default function HomeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: state } = useOnboardingState();
  const isWorker = state?.userType === "worker";
  const isHirer = state?.userType === "hirer";

  async function handleSignOut() {
    await signOut();
    qc.removeQueries({ queryKey: ONBOARDING_STATE_KEY });
    qc.removeQueries({ queryKey: NOTIFICATIONS_KEY });
    router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 p-6">
        <View className="items-center gap-1 pt-6">
          <Text className="text-5xl">🎉</Text>
          <Text className="text-2xl font-poppins-semibold text-foreground">
            You&apos;re verified
          </Text>
          <Text className="text-center text-muted-foreground">
            {isWorker
              ? "Your ODJ profile is approved. Set up your rates and availability to start getting hired."
              : "Your ODJ profile is approved. Find a worker whenever you need one."}
          </Text>
        </View>

        {isWorker ? (
          <Button onPress={() => router.push("/dashboard")}>
            <Text>Continue</Text>
          </Button>
        ) : null}

        {isHirer ? (
          <Button onPress={() => router.push("/(hirer)" as Href)}>
            <Text>Find a worker</Text>
          </Button>
        ) : null}

        <View className="gap-2">
          <Text className="font-poppins-medium text-foreground">Notifications</Text>
          <NotificationsList />
        </View>

        <View className="items-center pt-2">
          <ThemeToggle />
        </View>
      </ScrollView>
      <View className="p-6">
        <Button variant="ghost" onPress={handleSignOut}>
          <Text>Sign out</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
