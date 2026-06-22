import { View, Text } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { healthResponseSchema, type HealthResponse } from "@odj/shared";
import { apiFetch } from "@/lib/api";

/**
 * Live backend connectivity card. Proves the wiring end-to-end:
 * mobile → TanStack Query → Express `/api/health` → PostgreSQL.
 */
export function HealthStatus() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: async (): Promise<HealthResponse> =>
      healthResponseSchema.parse(await apiFetch("/api/health")),
    refetchInterval: 10_000,
  });

  const Dot = ({ ok }: { ok: boolean }) => (
    <View
      className={`mr-2 h-2.5 w-2.5 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`}
    />
  );

  return (
    <View className="w-full max-w-sm rounded-lg border border-border bg-card p-4">
      <Text className="mb-3 text-sm font-medium text-muted-foreground">
        Backend status
      </Text>
      {isLoading ? (
        <Text className="text-sm text-muted-foreground">Checking…</Text>
      ) : isError || !data ? (
        <View className="flex-row items-center">
          <Dot ok={false} />
          <Text className="text-sm text-card-foreground">API unreachable</Text>
        </View>
      ) : (
        <View className="gap-1.5">
          <View className="flex-row items-center">
            <Dot ok={data.status === "ok"} />
            <Text className="text-sm text-card-foreground">
              API: {data.status}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Dot ok={data.db === "connected"} />
            <Text className="text-sm text-card-foreground">
              Database: {data.db}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">
            uptime {data.uptimeSeconds}s · v{data.version}
          </Text>
        </View>
      )}
    </View>
  );
}
