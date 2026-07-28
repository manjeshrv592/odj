import { useQuery } from "@tanstack/react-query";
import { appApi, JOB_KEY } from "./app-api";
import { useSession } from "./auth-client";

/**
 * Poll a hiring job while it's still `searching` (every 2s); stop once it reaches
 * a terminal state (matched / cancelled / expired / no_workers). Drives the hirer
 * "searching…" → "matched" screen.
 */
export function useJob(jobId: string | null) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: jobId ? JOB_KEY(jobId) : ["job", "none"],
    queryFn: () => appApi.job(jobId!),
    enabled: !!session?.user && !!jobId,
    refetchInterval: (query) =>
      query.state.data?.status === "searching" ? 2000 : false,
  });
}
