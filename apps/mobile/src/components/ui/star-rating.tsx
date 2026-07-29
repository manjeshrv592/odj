import * as React from "react";
import { View, Pressable } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

interface StarRatingProps {
  value: number;
  /** Omit to render read-only (e.g. showing an existing rating or an aggregate). */
  onChange?: (value: number) => void;
  size?: "sm" | "lg";
}

/**
 * 1-5 star tap input, the rating counterpart to `OtpInput` — plain `★`/`☆` text
 * (no icon library installed; matches the app's emoji-based iconography).
 */
export function StarRating({ value, onChange, size = "lg" }: StarRatingProps) {
  const textSize = size === "lg" ? "text-4xl" : "text-xl";
  return (
    <View className="flex-row gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={!onChange}
          onPress={() => onChange?.(n)}
          accessibilityRole={onChange ? "button" : undefined}
          accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}
        >
          <Text
            className={cn(
              textSize,
              n <= value ? "text-primary" : "text-muted-foreground",
            )}
          >
            {n <= value ? "★" : "☆"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
