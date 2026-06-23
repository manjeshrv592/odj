import { useQuery } from "@tanstack/react-query";
import { appApi, NOTIFICATIONS_KEY } from "./app-api";
import { useSession } from "./auth-client";

/**
 * The signed-in user's in-app notifications (GET /api/app/notifications). Polled
 * so a verification decision surfaces without a manual refresh. Disabled until a
 * session exists.
 */
export function useNotifications() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: appApi.notifications,
    enabled: !!session?.user,
    refetchInterval: 30_000,
  });
}
