import { View, Pressable } from "react-native";
import { Text } from "./text";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** iOS-style segmented control — a row of pill options with one selected. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row gap-1 rounded-xl bg-secondary p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={cn(
              "flex-1 items-center rounded-lg py-2",
              active && "bg-background",
            )}
          >
            <Text
              className={cn(
                "text-sm",
                active
                  ? "font-poppins-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
