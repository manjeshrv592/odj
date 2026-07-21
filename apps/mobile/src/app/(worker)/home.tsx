import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/auth-client";
import { ONBOARDING_STATE_KEY, NOTIFICATIONS_KEY } from "@/lib/app-api";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsList } from "@/components/notifications-list";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

/**
 * Worker home — where a set-up worker lands. A Phase-4 job inbox lives here later;
 * for now it's an "all set" state + notifications + a way back to setup.
 */
export default function WorkerHome() {
  const router = useRouter();
  const qc = useQueryClient();

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
          <Text className="text-5xl">✅</Text>
          <Text className="text-2xl font-poppins-semibold text-foreground">
            You&apos;re all set
          </Text>
          <Text className="text-center text-muted-foreground">
            We&apos;ll notify you when a job comes your way. Job requests will show
            up here soon.
          </Text>
        </View>

        <Button variant="outline" onPress={() => router.push("/dashboard")}>
          <Text>Manage rates &amp; availability</Text>
        </Button>

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
