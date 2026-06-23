import { View, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/auth-client";
import { appApi, ONBOARDING_STATE_KEY } from "@/lib/app-api";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

/**
 * "Continue as" — the first onboarding screen for a user with no role yet.
 * Picking Work/Hire persists `userType` + creates the draft profile
 * (POST /api/app/onboarding/role), then enters that role's wizard. The choice is
 * fixed for this feature (changing roles later is a separate feature).
 */
export default function ContinueScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const choose = useMutation({
    mutationFn: (userType: "worker" | "hirer") => appApi.selectRole(userType),
    onSuccess: (state) => {
      qc.setQueryData(ONBOARDING_STATE_KEY, state);
      router.replace(
        state.userType === "hirer"
          ? "/(onboarding)/hirer"
          : "/(onboarding)/worker",
      );
    },
    onError: (e: Error) =>
      Alert.alert("Something went wrong", e.message || "Please try again."),
  });

  async function handleSignOut() {
    await signOut();
    qc.removeQueries({ queryKey: ONBOARDING_STATE_KEY });
    router.replace("/(auth)/login");
  }

  const busy = choose.isPending;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center gap-10 p-6">
        <View className="items-center gap-1">
          <Text className="text-2xl font-poppins-semibold">Continue as</Text>
          <Text className="text-center text-muted-foreground">
            How do you want to use ODJ?
          </Text>
        </View>

        <View className="gap-4">
          <Button
            size="lg"
            disabled={busy}
            onPress={() => choose.mutate("worker")}
          >
            {busy && choose.variables === "worker" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text>I want to Work</Text>
            )}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            disabled={busy}
            onPress={() => choose.mutate("hirer")}
          >
            {busy && choose.variables === "hirer" ? (
              <ActivityIndicator />
            ) : (
              <Text>I want to Hire</Text>
            )}
          </Button>
        </View>

        <Button variant="ghost" disabled={busy} onPress={handleSignOut}>
          <Text>Sign out</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
