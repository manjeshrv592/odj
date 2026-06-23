import * as React from "react";
import { Text } from "./text";
import { cn } from "@/lib/utils";

/** Form field label (medium weight, slightly muted). */
export function Label({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn("font-poppins-medium text-sm text-foreground", className)}
      {...props}
    />
  );
}
