import "../global.css";

import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
// Import each weight from its own subpath, NOT from the package root. The root
// `index.js` is a barrel that `require()`s all 18 Poppins weights, and Metro
// can't tree-shake asset requires — importing from it ships every weight and
// cost ~2.4 MB of dead font data in the APK.
import { useFonts } from "@expo-google-fonts/poppins/useFonts";
import { Poppins_400Regular } from "@expo-google-fonts/poppins/400Regular";
import { Poppins_500Medium } from "@expo-google-fonts/poppins/500Medium";
import { Poppins_600SemiBold } from "@expo-google-fonts/poppins/600SemiBold";
import { Poppins_700Bold } from "@expo-google-fonts/poppins/700Bold";
import { Providers } from "@/components/providers";
import { useSession } from "@/lib/auth-client";
import { useOnboardingState } from "@/lib/use-onboarding";
import { usePushRegistration, useNotificationTapRouting } from "@/lib/use-push";

/**
 * Auth/onboarding routing gate. Watches the better-auth session and the mobile
 * onboarding state (GET /api/app/me) and keeps the user on the right screen:
 *
 * - unauthenticated              → (auth)/login
 * - authed, no role picked       → (auth)/continue ("Continue as")
 * - authed, draft profile        → (onboarding)/{worker|hirer} (resumes at step)
 * - authed, under_review         → (onboarding)/under-review
 * - authed, rejected             → (onboarding)/rejected (reason + re-submit)
 * - authed, approved             → index (full app — later)
 *
 * Routing is driven by the profile `status`, not the legacy `onboardingCompleted`
 * boolean (which is reserved for the future "approved → in-app" flip). A spinner
 * is shown while the session restores and while the onboarding state loads.
 */
function SessionGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const authed = !!session?.user;
  const { data: state, isLoading: stateLoading } = useOnboardingState();
  const segments = useSegments();
  const router = useRouter();

  // Register this device's Expo push token once signed in (best-effort), and
  // route a tapped notification to the right screen (e.g. job_completed → rate).
  usePushRegistration();
  useNotificationTapRouting(state?.userType);

  useEffect(() => {
    if (isPending) return;

    const seg = segments as string[];
    const inAuthGroup = seg[0] === "(auth)";
    const inOnboarding = seg[0] === "(onboarding)";

    if (!authed) {
      if (!inAuthGroup) router.replace("/(auth)/login");
      return;
    }

    // Authed — wait for the onboarding state before routing.
    if (stateLoading || !state) return;

    if (!state.userType) {
      if (seg[1] !== "continue") router.replace("/(auth)/continue");
      return;
    }

    if (state.status === "approved") {
      // Route to the role's tab home on *arrival* (fresh login / just approved /
      // the root index); don't bounce in-app navigation within the tab groups.
      const onEntry = inAuthGroup || inOnboarding || seg.length === 0;
      if (onEntry) {
        router.replace(
          state.userType === "hirer" ? "/(hirer)" : "/(worker)/home",
        );
      }
      return;
    }

    if (state.status === "rejected") {
      // Allow the rejected screen and the consolidated edit screens (re-submit
      // flow); bounce anything else back to the rejection notice.
      const allowed = ["rejected", "edit-worker", "edit-hirer"];
      if (!allowed.includes(seg[1] ?? "")) {
        router.replace("/(onboarding)/rejected");
      }
      return;
    }

    if (state.status === "under_review") {
      if (seg[1] !== "under-review")
        router.replace("/(onboarding)/under-review");
      return;
    }

    // Draft (or no profile row yet): resume the wizard for the chosen role.
    const target =
      state.userType === "hirer"
        ? "/(onboarding)/hirer"
        : "/(onboarding)/worker";
    if (seg[1] !== state.userType) router.replace(target);
  }, [isPending, authed, state, stateLoading, segments, router]);

  if (isPending || (authed && stateLoading)) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  // Load the Poppins brand typeface (one file per weight — RN can't synthesise
  // weights). Hold the UI until they're ready so text doesn't flash a fallback.
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View
        style={{ flex: 1 }}
        className="flex-1 items-center justify-center bg-background"
      >
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Providers>
          <SessionGate>
            <Stack screenOptions={{ headerShown: false }} />
          </SessionGate>
          <StatusBar style="auto" />
        </Providers>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
