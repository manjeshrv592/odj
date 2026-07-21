import * as React from "react";
import { View, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Calendar, type DateData } from "react-native-calendars";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DayOffScope } from "@odj/shared";
import { appApi, WORKER_DAYS_OFF_KEY, ONBOARDING_STATE_KEY } from "@/lib/app-api";
import { useWorkerRates, useWorkerDaysOff } from "@/lib/use-worker";
import { useTheme } from "@/components/providers";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";

const OFF_COLOR = "#ef4444"; // destructive — a day marked off

/** First day of the month containing `iso` (YYYY-MM-DD), as YYYY-MM-01. */
function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}
/** Last day of the month containing `iso`, as YYYY-MM-DD. */
function monthEnd(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(y!, m!, 0).getDate();
  return `${iso.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

export default function WorkerAvailabilityScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { colorScheme } = useTheme();
  const dark = colorScheme === "dark";

  const todayIso = new Date().toISOString().slice(0, 10);
  const [visible, setVisible] = React.useState(monthStart(todayIso));
  const [scope, setScope] = React.useState<DayOffScope>("all");

  const from = monthStart(visible);
  const to = monthEnd(visible);

  const { data: professions } = useWorkerRates();
  const { data: daysOff, isLoading } = useWorkerDaysOff(from, to);

  // Opening this screen acknowledges the (optional) availability step — flip the
  // dashboard checkmark. Fire once on mount; ignore failures (best-effort).
  React.useEffect(() => {
    appApi
      .markAvailabilityReviewed()
      .then(() => qc.invalidateQueries({ queryKey: ONBOARDING_STATE_KEY }))
      .catch(() => {});
  }, [qc]);

  const scopeOptions: SelectOption[] = React.useMemo(
    () => [
      { value: "all", label: "All professions" },
      ...(professions ?? []).map((p) => ({
        value: p.professionId,
        label: p.name,
      })),
    ],
    [professions],
  );

  // Dates off in the *current scope* (all-row vs the selected profession's rows).
  const offDates = React.useMemo(() => {
    const set = new Set<string>();
    for (const d of daysOff ?? []) {
      const matches =
        scope === "all" ? d.professionId === null : d.professionId === scope;
      if (matches) set.add(d.date);
    }
    return set;
  }, [daysOff, scope]);

  const markedDates = React.useMemo(() => {
    const marks: Record<string, { selected: boolean; selectedColor: string }> =
      {};
    for (const date of offDates) {
      marks[date] = { selected: true, selectedColor: OFF_COLOR };
    }
    return marks;
  }, [offDates]);

  const toggle = useMutation({
    mutationFn: (date: string) =>
      appApi.toggleDayOff({ date, scope, off: !offDates.has(date) }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [...WORKER_DAYS_OFF_KEY, from, to] }),
    onError: (e: Error) => Alert.alert("Couldn't update", e.message),
  });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-5 p-6">
        <View className="gap-1 pt-2">
          <Text className="text-2xl font-poppins-semibold text-foreground">
            Availability
          </Text>
          <Text className="text-muted-foreground">
            Tap a day to mark it off. Days are bookable by default. Choose
            &ldquo;All professions&rdquo; or a single profession below.
          </Text>
        </View>

        <View className="gap-1.5">
          <Text className="font-poppins-medium text-foreground">
            Marking days off for
          </Text>
          <Select
            value={scope}
            options={scopeOptions}
            onChange={(v) => setScope(v as DayOffScope)}
          />
        </View>

        <Card className="p-2">
          <Calendar
            current={visible}
            minDate={todayIso}
            onMonthChange={(m: DateData) => setVisible(monthStart(m.dateString))}
            onDayPress={(d: DateData) => toggle.mutate(d.dateString)}
            markedDates={markedDates}
            theme={{
              calendarBackground: "transparent",
              monthTextColor: dark ? "#f8fafc" : "#0f172a",
              dayTextColor: dark ? "#f8fafc" : "#0f172a",
              textDisabledColor: dark ? "#475569" : "#cbd5e1",
              todayTextColor: "#2563eb",
              arrowColor: "#2563eb",
              selectedDayTextColor: "#ffffff",
            }}
          />
        </Card>

        <View className="flex-row items-center gap-2">
          <View
            className="size-3 rounded-full"
            style={{ backgroundColor: OFF_COLOR }}
          />
          <Text className="text-sm text-muted-foreground">Marked as off</Text>
          {isLoading || toggle.isPending ? (
            <ActivityIndicator size="small" />
          ) : null}
        </View>
      </ScrollView>

      <View className="p-6">
        <Button variant="ghost" onPress={() => router.back()}>
          <Text>Done</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
