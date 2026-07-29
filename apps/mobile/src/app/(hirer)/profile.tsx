import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/auth-client";
import { ONBOARDING_STATE_KEY, NOTIFICATIONS_KEY } from "@/lib/app-api";
import { useOnboardingState } from "@/lib/use-onboarding";
import { NotificationsList } from "@/components/notifications-list";
import { ThemeToggle } from "@/components/theme-toggle";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StarRating } from "@/components/ui/star-rating";

/** Hirer Profile tab — notifications + account. */
export default function HirerProfile() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: state } = useOnboardingState();
  const hirer = state?.hirer;

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
            <StarRating value={Math.round(hirer?.avgRating ?? 0)} size="sm" />
            <Text className="text-sm text-muted-foreground">
              {hirer?.ratingCount
                ? `${hirer.avgRating!.toFixed(1)} (${hirer.ratingCount})`
                : "No ratings yet"}
            </Text>
          </View>
        </Card>

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
