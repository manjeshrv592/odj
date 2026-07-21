import { Stack } from "expo-router";

/** Approved-worker area (rates, availability, location). Headers hidden — each
 * screen renders its own header inside the safe area, matching onboarding. */
export default function WorkerLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
