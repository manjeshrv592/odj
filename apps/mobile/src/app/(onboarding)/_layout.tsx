import { Stack } from "expo-router";

/** Onboarding wizard group — headers hidden (each screen draws its own chrome). */
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
