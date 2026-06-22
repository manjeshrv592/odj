import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Providers } from "@/components/providers";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Providers>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="auto" />
        </Providers>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
