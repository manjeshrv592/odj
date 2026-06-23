import "../global.css";

import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { Providers } from "@/components/providers";
import { useSession } from "@/lib/auth-client";
import { useOnboardingState } from "@/lib/use-onboarding";

/**
 * Auth/onboarding routing gate. Watches the better-auth session and the mobile
 * onboarding state (GET /api/app/me) and keeps the user on the right screen:
 *
 * - unauthenticated              → (auth)/login
 * - authed, no role picked       → (auth)/continue ("Continue as")
 * - authed, draft profile        → (onboarding)/{worker|hirer} (resumes at step)
 * - authed, submitted/rejected   → (onboarding)/under-review
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
      if (inAuthGroup || inOnboarding) router.replace("/");
      return;
    }

    if (state.status === "under_review" || state.status === "rejected") {
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
