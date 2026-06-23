import * as React from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";

/** Simple bordered surface — the mobile counterpart of the web `Card`. */
export function Card({
  className,
  ...props
}: React.ComponentProps<typeof View>) {
  return (
    <View
      className={cn(
        "rounded-2xl border border-border bg-card p-4",
        className,
      )}
      {...props}
    />
  );
}
