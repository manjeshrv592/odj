import * as React from "react";
import { TextInput } from "react-native";
import { cn } from "@/lib/utils";

/** Themed single-line text input (NativeWind). */
export function Input({
  className,
  ...props
}: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      className={cn(
        "h-12 rounded-lg border border-border bg-background px-4 font-sans text-base text-foreground",
        className,
      )}
      placeholderTextColor="#9ca3af"
      {...props}
    />
  );
}
