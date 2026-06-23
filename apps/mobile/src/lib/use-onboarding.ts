import { useQuery } from "@tanstack/react-query";
import { appApi, ONBOARDING_STATE_KEY } from "./app-api";
import { useSession } from "./auth-client";

/**
 * The signed-in user's onboarding state (GET /api/app/me). Drives both the
 * SessionGate routing and the wizard's resume hydration. Disabled until a
 * session exists; kept fresh (`staleTime: 0`) so role/step changes route promptly.
 */
export function useOnboardingState() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ONBOARDING_STATE_KEY,
    queryFn: appApi.me,
    enabled: !!session?.user,
    staleTime: 0,
  });
}
