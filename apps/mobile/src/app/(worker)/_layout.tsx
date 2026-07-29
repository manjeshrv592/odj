import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTheme } from "@/components/providers";

/** Emoji tab icon (no icon-font dependency). */
function TabEmoji({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

/** Approved-worker area — bottom tabs: Home / Jobs / Profile. */
export default function WorkerLayout() {
  const { colorScheme } = useTheme();
  const dark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: dark ? "#a1a1aa" : "#71717a",
        tabBarStyle: {
          backgroundColor: dark ? "#09090b" : "#ffffff",
          borderTopColor: dark ? "#27272a" : "#e5e7eb",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home", tabBarIcon: () => <TabEmoji emoji="🏠" /> }}
      />
      <Tabs.Screen
        name="jobs"
        options={{ title: "Jobs", tabBarIcon: () => <TabEmoji emoji="🧰" /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: () => <TabEmoji emoji="👤" /> }}
      />
      {/* Non-tab screens (navigated to via push). */}
      <Tabs.Screen name="rates" options={{ href: null }} />
      <Tabs.Screen name="availability" options={{ href: null }} />
      <Tabs.Screen name="location" options={{ href: null }} />
      <Tabs.Screen name="job" options={{ href: null }} />
      <Tabs.Screen name="rate-job" options={{ href: null }} />
      <Tabs.Screen name="hirer-profile" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
    </Tabs>
  );
}
