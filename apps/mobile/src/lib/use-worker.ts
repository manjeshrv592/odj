import { useQuery } from "@tanstack/react-query";
import {
  appApi,
  WORKER_RATES_KEY,
  WORKER_DAYS_OFF_KEY,
  WORKER_OFFERS_KEY,
} from "./app-api";
import { useSession } from "./auth-client";

/**
 * Post-approval worker data hooks. All gated on a session; the backend further
 * gates on an *approved* worker profile (these screens are only reachable from
 * the approved home).
 */

/** The worker's professions with admin price bounds + their set rates. */
export function useWorkerRates() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: WORKER_RATES_KEY,
    queryFn: appApi.workerRates,
    enabled: !!session?.user,
  });
}

/** The worker's days off across a date range (calendar marking). */
export function useWorkerDaysOff(from: string, to: string) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: [...WORKER_DAYS_OFF_KEY, from, to],
    queryFn: () => appApi.workerDaysOff(from, to),
    enabled: !!session?.user,
  });
}

/** Pending job offers — polled every 3s while the worker is online. */
export function useWorkerOffers(enabled: boolean) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: WORKER_OFFERS_KEY,
    queryFn: appApi.workerOffers,
    enabled: !!session?.user && enabled,
    refetchInterval: enabled ? 3000 : false,
  });
}
