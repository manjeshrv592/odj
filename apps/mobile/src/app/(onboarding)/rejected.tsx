import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/auth-client";
import { ONBOARDING_STATE_KEY } from "@/lib/app-api";
import { useOnboardingState } from "@/lib/use-onboarding";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Shown when an admin rejects a worker/hirer profile (status `rejected`). Surfaces
 * the rejection reason and lets the user re-open their profile to fix it and
 * re-submit (→ the consolidated edit screen for their role).
 */
export default function RejectedScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: state } = useOnboardingState();

  const reason =
    state?.worker?.rejectionReason ?? state?.hirer?.rejectionReason ?? null;
  const editHref =
    state?.userType === "hirer"
      ? "/(onboarding)/edit-hirer"
      : "/(onboarding)/edit-worker";

  async function handleSignOut() {
    await signOut();
    qc.removeQueries({ queryKey: ONBOARDING_STATE_KEY });
    router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="flex-grow justify-center gap-6 p-8">
        <View className="items-center gap-3">
          <Text className="text-6xl">📝</Text>
          <Text className="text-center text-2xl font-poppins-semibold">
            A few changes needed
          </Text>
          <Text className="text-center text-muted-foreground">
            Our team reviewed your profile and needs some updates before it can be
            approved.
          </Text>
        </View>

        {reason ? (
          <Card className="gap-1 p-4">
            <Text className="text-sm font-poppins-medium text-muted-foreground">
              What to fix
            </Text>
            <Text className="text-base">{reason}</Text>
          </Card>
        ) : null}

        <Button size="lg" onPress={() => router.push(editHref)}>
          <Text>Update &amp; re-submit</Text>
        </Button>
      </ScrollView>
      <View className="p-6">
        <Button variant="ghost" onPress={handleSignOut}>
          <Text>Sign out</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
