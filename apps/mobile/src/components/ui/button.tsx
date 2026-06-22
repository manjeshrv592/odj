import * as React from "react";
import { Pressable } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { TextClassContext } from "./text";

const buttonVariants = cva(
  "flex-row items-center justify-center gap-2 rounded-xl",
  {
    variants: {
      variant: {
        default: "bg-primary active:opacity-90",
        outline: "border border-border bg-background active:bg-secondary",
        secondary: "bg-secondary active:opacity-90",
        ghost: "active:bg-secondary",
      },
      size: {
        default: "h-12 px-5",
        sm: "h-10 px-3",
        lg: "h-14 px-6",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

const buttonTextVariants = cva("font-poppins-semibold text-base", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      outline: "text-foreground",
      secondary: "text-secondary-foreground",
      ghost: "text-foreground",
    },
    size: { default: "", sm: "text-sm", lg: "text-lg" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

type ButtonProps = React.ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants>;

/** Pressable button with rnr-style variants; styles its descendant `Text`. */
export function Button({
  className,
  variant,
  size,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Pressable
        className={cn(
          buttonVariants({ variant, size }),
          disabled && "opacity-50",
          className,
        )}
        disabled={disabled}
        accessibilityRole="button"
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export { buttonVariants, buttonTextVariants };
