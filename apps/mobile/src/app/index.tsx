import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { HealthStatus } from "@/components/health-status";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-6 p-6">
        <View className="items-center">
          <Text className="text-3xl font-bold text-foreground">
            ODJ mobile app
          </Text>
          <Text className="mt-1 text-muted-foreground">
            Hiring platform — mobile client
          </Text>
        </View>

        <HealthStatus />
        <ThemeToggle />
      </View>
    </SafeAreaView>
  );
}
