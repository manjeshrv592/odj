import * as React from "react";
import { View, Pressable } from "react-native";
import { Text } from "./text";
import { cn } from "@/lib/utils";

export interface ChipOption {
  value: string;
  label: string;
}

/**
 * Multi-select chip group. Tapping a chip toggles it in `selected`. Used for the
 * worker languages and professions steps. Selected chips fill with the primary.
 */
export function Chips({
  options,
  selected,
  onChange,
}: {
  options: ChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={() => toggle(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={cn(
              "rounded-xl border px-4 py-2 active:opacity-90",
              active
                ? "border-primary bg-primary"
                : "border-border bg-background",
            )}
          >
            <Text
              className={cn(
                "font-poppins-medium text-sm",
                active ? "text-primary-foreground" : "text-foreground",
              )}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
