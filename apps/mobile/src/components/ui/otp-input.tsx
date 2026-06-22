import * as React from "react";
import { View, TextInput } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Number of digits. */
  length?: number;
  autoFocus?: boolean;
}

/**
 * Segmented one-time-code input (the mobile counterpart to shadcn's `input-otp`).
 * A single transparent `TextInput` overlays the row and captures input/keyboard;
 * the boxes underneath render each digit, highlighting the active slot.
 * Reusable — drives state via `value`/`onChange` like a controlled input.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus,
}: OtpInputProps) {
  const [focused, setFocused] = React.useState(false);
  const digits = value.split("");
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <View className="relative">
      <View className="flex-row justify-center gap-2">
        {Array.from({ length }).map((_, i) => {
          const isActive = focused && i === activeIndex;
          return (
            <View
              key={i}
              className={cn(
                "h-14 w-12 items-center justify-center rounded-lg border bg-background",
                isActive ? "border-2 border-primary" : "border border-border",
              )}
            >
              <Text className="text-2xl font-poppins-semibold text-foreground">
                {digits[i] ?? ""}
              </Text>
            </View>
          );
        })}
      </View>

      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Transparent overlay so taps focus it and the keyboard drives the boxes.
        className="absolute inset-0 text-transparent opacity-0"
      />
    </View>
  );
}
