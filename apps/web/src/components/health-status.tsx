"use client";

import { useQuery } from "@tanstack/react-query";
import { healthResponseSchema, type HealthResponse } from "@odj/shared";
import { apiFetch } from "@/lib/api";

/**
 * Live backend connectivity card. Proves the full wiring end-to-end:
 * web → TanStack Query → Express `/api/health` → PostgreSQL.
 */
export function HealthStatus() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: async (): Promise<HealthResponse> =>
      healthResponseSchema.parse(await apiFetch("/api/health")),
    refetchInterval: 10_000,
  });

  const dot = (ok: boolean) =>
    `inline-block size-2.5 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`;

  return (
    <div className="rounded-lg border bg-card text-card-foreground p-4 w-full max-w-sm">
      <h2 className="text-sm font-medium text-muted-foreground mb-3">
        Backend status
      </h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Checking…</p>
      ) : isError || !data ? (
        <p className="text-sm">
          <span className={dot(false)} /> API unreachable
        </p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          <li>
            <span className={dot(data.status === "ok")} /> API: {data.status}
          </li>
          <li>
            <span className={dot(data.db === "connected")} /> Database:{" "}
            {data.db}
          </li>
          <li className="text-muted-foreground">
            uptime {data.uptimeSeconds}s · v{data.version}
          </li>
        </ul>
      )}
    </div>
  );
}
