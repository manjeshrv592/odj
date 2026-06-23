import * as React from "react";
import { Pressable, Modal, FlatList } from "react-native";
import { Text } from "./text";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Single-choice picker. The trigger looks like our `Input`; tapping it opens a
 * bottom-sheet-style modal list. Used for `select` requirement fields and the
 * hirer org-type. Keeps RN's lack of a native styled `<select>` out of screens.
 */
export function Select({
  value,
  options,
  placeholder = "Select…",
  onChange,
}: {
  value?: string | null;
  options: SelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className="h-12 flex-row items-center justify-between rounded-lg border border-border bg-background px-4 active:opacity-90"
      >
        <Text
          className={cn(
            "text-base",
            selected ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Text className="text-muted-foreground">▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setOpen(false)}
        >
          <Pressable className="max-h-[60%] rounded-t-2xl border-t border-border bg-card p-2">
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "rounded-xl px-4 py-3 active:bg-secondary",
                      active && "bg-secondary",
                    )}
                  >
                    <Text
                      className={cn(
                        "text-base",
                        active && "font-poppins-medium text-primary",
                      )}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
