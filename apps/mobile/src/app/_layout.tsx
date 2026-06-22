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

/**
 * Auth/onboarding routing gate. Watches the better-auth session and keeps the
 * user on the right screen group:
 *
 * - unauthenticated            → (auth)/login
 * - authed + !onboarding done  → (auth)/continue ("Continue as")
 * - authed + onboarding done   → index (home)
 *
 * While the session restores (expo-secure-store) a spinner is shown.
 */
function SessionGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;

    const seg = segments as string[];
    const inAuthGroup = seg[0] === "(auth)";
    const onContinue = seg[1] === "continue";
    const user = session?.user;

    if (!user) {
      if (!inAuthGroup) router.replace("/(auth)/login");
      return;
    }

    if (!user.onboardingCompleted) {
      if (!onContinue) router.replace("/(auth)/continue");
      return;
    }

    // Fully onboarded: get out of the auth group.
    if (inAuthGroup) router.replace("/");
  }, [isPending, session, segments, router]);

  if (isPending) {
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
