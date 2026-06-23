import * as React from "react";
import { Switch as RNSwitch, Platform } from "react-native";
import { useTheme } from "@/components/providers";

/**
 * Themed toggle built on RN's core `Switch`. Tracks the brand primary when on.
 * (RN `Switch` colors are set via props, not className.)
 */
export function Switch(props: React.ComponentProps<typeof RNSwitch>) {
  const { colorScheme } = useTheme();
  const primary = colorScheme === "dark" ? "#3b82f6" : "#2563eb";
  return (
    <RNSwitch
      trackColor={{ false: "#9ca3af", true: primary }}
      thumbColor={Platform.OS === "android" ? "#ffffff" : undefined}
      ios_backgroundColor="#9ca3af"
      {...props}
    />
  );
}
