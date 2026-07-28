import { useQuery } from "@tanstack/react-query";
import { appApi, JOB_KEY } from "./app-api";
import { useSession } from "./auth-client";

/** Job states where the hirer screen is still live and should keep polling. */
const LIVE_JOB_STATUSES = ["searching", "matched", "in_progress"];

/**
 * Poll a hiring job through its live lifecycle (searching → matched → in_progress)
 * every 2s; stop once terminal (completed / cancelled / expired / no_workers).
 * Drives the hirer "searching…" → match → OTP → completed screen.
 */
export function useJob(jobId: string | null) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: jobId ? JOB_KEY(jobId) : ["job", "none"],
    queryFn: () => appApi.job(jobId!),
    enabled: !!session?.user && !!jobId,
    refetchInterval: (query) =>
      LIVE_JOB_STATUSES.includes(query.state.data?.status ?? "") ? 2000 : false,
  });
}
