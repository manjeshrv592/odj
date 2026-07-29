import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTheme } from "@/components/providers";

function TabEmoji({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

/** Approved-hirer area — bottom tabs: Home / Jobs / Profile. */
export default function HirerLayout() {
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
        name="index"
        options={{ title: "Home", tabBarIcon: () => <TabEmoji emoji="🔍" /> }}
      />
      <Tabs.Screen
        name="jobs"
        options={{ title: "Jobs", tabBarIcon: () => <TabEmoji emoji="🧰" /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: () => <TabEmoji emoji="👤" /> }}
      />
      <Tabs.Screen name="professions" options={{ href: null }} />
      <Tabs.Screen name="book" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="rate-job" options={{ href: null }} />
      <Tabs.Screen name="worker-profile" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
    </Tabs>
  );
}
