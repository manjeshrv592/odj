import * as React from "react";
import { View } from "react-native";
import { Text } from "./text";
import { Label } from "./label";
import { cn } from "@/lib/utils";

/**
 * Labelled form field wrapper: a label (with an optional required asterisk), the
 * input(s), and an optional helper or error line. Keeps spacing consistent across
 * the onboarding steps without each screen repeating the layout.
 */
export function Field({
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  label?: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <View className={cn("gap-1.5", className)}>
      {label ? (
        <Label>
          {label}
          {required ? <Text className="text-destructive"> *</Text> : null}
        </Label>
      ) : null}
      {children}
      {error ? (
        <Text className="text-sm text-destructive">{error}</Text>
      ) : hint ? (
        <Text className="text-sm text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
  );
}
