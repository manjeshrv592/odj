import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/auth-client";
import { ONBOARDING_STATE_KEY } from "@/lib/app-api";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

/**
 * Shown after a worker/hirer submits their profile (status `under_review`). Admin
 * verification is a later feature — for now this is the resting state until then.
 */
export default function UnderReviewScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  async function handleSignOut() {
    await signOut();
    qc.removeQueries({ queryKey: ONBOARDING_STATE_KEY });
    router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-6 p-8">
        <Text className="text-6xl">🎉</Text>
        <View className="items-center gap-2">
          <Text className="text-center text-2xl font-poppins-semibold">
            Thanks — you&apos;re all set!
          </Text>
          <Text className="text-center text-muted-foreground">
            Your profile is under verification. We&apos;ll notify you within 24
            hours once it&apos;s reviewed.
          </Text>
        </View>
      </View>
      <View className="p-6">
        <Button variant="ghost" onPress={handleSignOut}>
          <Text>Sign out</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
