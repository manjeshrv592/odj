import * as React from "react";
import { Text as RNText } from "react-native";
import { cn } from "@/lib/utils";

/**
 * Lets a parent (e.g. `Button`) set the text style for its descendant `Text`
 * without each call site repeating colour/size classes. react-native-reusables
 * convention.
 */
export const TextClassContext = React.createContext<string | undefined>(
  undefined,
);

/** Themed text primitive. Inherits classes from the nearest TextClassContext. */
export function Text({
  className,
  ...props
}: React.ComponentProps<typeof RNText>) {
  const contextClass = React.useContext(TextClassContext);
  return (
    <RNText
      className={cn("font-sans text-base text-foreground", contextClass, className)}
      {...props}
    />
  );
}
