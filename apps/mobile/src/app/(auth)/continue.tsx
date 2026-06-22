import { View, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { signOut } from "@/lib/auth-client";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

/**
 * "Continue as" — shown to an authenticated user who hasn't finished onboarding.
 *
 * The two buttons are STUBS for this feature: real role selection + profile
 * completion (persisting userType=worker|hirer and onboardingCompleted) is the
 * next feature. For now they just acknowledge the tap.
 */
export default function ContinueScreen() {
  const router = useRouter();

  function pick(role: "Work" | "Hire") {
    Alert.alert(
      "Coming soon",
      `"${role}" selection and profile setup arrive in the next update.`,
    );
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/(auth)/login");
  }

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
          <Button size="lg" onPress={() => pick("Work")}>
            <Text>I want to Work</Text>
          </Button>
          <Button size="lg" variant="secondary" onPress={() => pick("Hire")}>
            <Text>I want to Hire</Text>
          </Button>
        </View>

        <Button variant="ghost" onPress={handleSignOut}>
          <Text>Sign out</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
