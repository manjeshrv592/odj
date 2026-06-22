import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { otpSchema } from "@odj/shared";
import { signIn } from "@/lib/auth-client";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";

/**
 * Enter the email OTP. On success better-auth stores the session in
 * expo-secure-store and the root SessionGate routes onward (→ "Continue as").
 */
export default function OtpScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function verify() {
    setError(null);
    if (!otpSchema.safeParse(otp).success) {
      setError("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await signIn.emailOtp({ email, otp });
      if (signInError)
        throw new Error(signInError.message ?? "Invalid or expired code");
      // SessionGate handles navigation once the session updates.
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center gap-8 p-6">
        <View className="items-center gap-1">
          <Text className="text-2xl font-poppins-semibold">Check your email</Text>
          <Text className="text-center text-muted-foreground">
            We sent a 6-digit code to {email}
          </Text>
        </View>

        <View className="gap-3">
          <OtpInput value={otp} onChange={setOtp} length={6} autoFocus />
          {error ? (
            <Text className="text-center text-sm text-destructive">{error}</Text>
          ) : null}
          <Button onPress={verify} disabled={loading}>
            <Text>{loading ? "Verifying…" : "Verify & sign in"}</Text>
          </Button>
          <Button variant="ghost" onPress={() => router.back()}>
            <Text>Use a different email</Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
