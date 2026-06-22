import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { emailSchema } from "@odj/shared";
import { emailOtp } from "@/lib/auth-client";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Method = "email" | "phone";

/** Worker/hirer login: choose email or phone (phone stubbed), then send OTP. */
export default function LoginScreen() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError("Enter a valid email address");
      return;
    }
    setLoading(true);
    try {
      const { error: otpError } = await emailOtp.sendVerificationOtp({
        email: parsed.data,
        type: "sign-in",
      });
      if (otpError) throw new Error(otpError.message ?? "Couldn't send code");
      router.push({ pathname: "/(auth)/otp", params: { email: parsed.data } });
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
          <Text className="text-3xl font-poppins-semibold">ODJ</Text>
          <Text className="text-muted-foreground">Sign in to get started</Text>
        </View>

        <View className="flex-row gap-3">
          <Button
            variant={method === "email" ? "default" : "outline"}
            className="flex-1"
            onPress={() => setMethod("email")}
          >
            <Text>Email</Text>
          </Button>
          <Button
            variant={method === "phone" ? "default" : "outline"}
            className="flex-1"
            onPress={() => setMethod("phone")}
          >
            <Text>Phone</Text>
          </Button>
        </View>

        {method === "phone" ? (
          <Text className="text-center text-muted-foreground">
            Phone login isn&apos;t available yet — please continue with email.
          </Text>
        ) : (
          <View className="gap-3">
            <Input
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            {error ? (
              <Text className="text-sm text-destructive">{error}</Text>
            ) : null}
            <Button onPress={sendCode} disabled={loading}>
              <Text>{loading ? "Sending…" : "Send code"}</Text>
            </Button>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
