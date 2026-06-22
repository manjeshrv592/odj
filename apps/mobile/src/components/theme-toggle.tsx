import { Pressable, Text } from "react-native";
import { useTheme } from "@/components/providers";

/** Simple light/dark toggle button using NativeWind classes + ThemeContext. */
export function ThemeToggle() {
  const { colorScheme, toggle } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Toggle theme"
      onPress={toggle}
      className="rounded-md border border-border bg-secondary px-4 py-2 active:opacity-70"
    >
      <Text className="text-secondary-foreground">
        {colorScheme === "dark" ? "☀️  Light mode" : "🌙  Dark mode"}
      </Text>
    </Pressable>
  );
}
