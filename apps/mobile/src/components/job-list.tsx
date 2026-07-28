import * as React from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { JobListItem, JobListFilter } from "@odj/shared";
import { useSession } from "@/lib/auth-client";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";

const FILTERS: { value: JobListFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

/** Human label + tone for a job status. */
function statusLabel(s: JobListItem["status"]): string {
  switch (s) {
    case "searching":
      return "Searching…";
    case "matched":
      return "Matched";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    case "no_workers":
      return "No workers";
  }
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/**
 * Active / Completed / Cancelled job list, shared by the worker + hirer Jobs tabs.
 * `fetcher` returns the role's jobs for a filter; `onOpenActive` (optional) makes
 * active rows tappable to resume the live job.
 */
export function JobList({
  keyBase,
  fetcher,
  onOpenActive,
}: {
  keyBase: string;
  fetcher: (filter: JobListFilter) => Promise<JobListItem[]>;
  onOpenActive?: (item: JobListItem) => void;
}) {
  const { data: session } = useSession();
  const [filter, setFilter] = React.useState<JobListFilter>("active");

  const { data: jobs, isLoading } = useQuery({
    queryKey: [keyBase, "jobs", filter],
    queryFn: () => fetcher(filter),
    enabled: !!session?.user,
    refetchInterval: filter === "active" ? 5000 : false,
  });

  return (
    <View className="gap-4">
      <Segmented value={filter} options={FILTERS} onChange={setFilter} />

      {isLoading ? (
        <ActivityIndicator className="mt-8" />
      ) : (jobs ?? []).length === 0 ? (
        <Text className="mt-6 text-center text-sm text-muted-foreground">
          No {filter} jobs.
        </Text>
      ) : (
        <View className="gap-2">
          {(jobs ?? []).map((j) => {
            const tappable = filter === "active" && !!onOpenActive;
            const Row = (
              <Card className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className="font-poppins-medium text-foreground">
                    {j.professionName}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {j.counterpartName} · {fmtDate(j.createdAt)}
                  </Text>
                </View>
                <Text className="text-sm text-muted-foreground">
                  {statusLabel(j.status)}
                </Text>
              </Card>
            );
            return tappable ? (
              <Pressable key={j.id} onPress={() => onOpenActive!(j)}>
                {Row}
              </Pressable>
            ) : (
              <View key={j.id}>{Row}</View>
            );
          })}
        </View>
      )}
    </View>
  );
}
