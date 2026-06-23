import * as React from "react";
import { View, Pressable } from "react-native";
import { Text } from "./text";
import { cn } from "@/lib/utils";

/**
 * Wizard header: a back affordance, a "Step n of N" label, and a thin progress
 * bar. Back is hidden on the first step. Shared by the worker & hirer wizards.
 */
export function ProgressHeader({
  step,
  total,
  title,
  onBack,
}: {
  step: number;
  total: number;
  title: string;
  onBack?: () => void;
}) {
  const pct = Math.round(((step + 1) / total) * 100);
  return (
    <View className="gap-3 pb-2">
      <View className="h-10 flex-row items-center">
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            hitSlop={12}
            className="active:opacity-60"
          >
            <Text className="text-base text-foreground">‹ Back</Text>
          </Pressable>
        ) : null}
      </View>

      <View className="h-2 overflow-hidden rounded-full bg-secondary">
        <View
          className={cn("h-full rounded-full bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </View>

      <View className="gap-1">
        <Text className="text-sm text-muted-foreground">
          Step {step + 1} of {total}
        </Text>
        <Text className="text-2xl font-poppins-semibold">{title}</Text>
      </View>
    </View>
  );
}
