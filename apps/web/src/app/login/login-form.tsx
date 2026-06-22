"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { emailSchema, otpSchema } from "@odj/shared";
import { authClient, signIn, signOut, emailOtp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Method = "email" | "phone";

/**
 * Admin portal login. Email-OTP only; phone is stubbed. Two steps for email:
 * enter address → enter the 6-digit code. After a successful sign-in the user is
 * authorized: non-admins are signed back out (the portal is invite-only).
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const invited = params.get("invited") ?? "";

  const [method, setMethod] = useState<Method>("email");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState(invited);
  const [otp, setOtp] = useState("");

  const sendOtp = useMutation({
    mutationFn: async () => {
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) throw new Error("Enter a valid email address");
      const { error } = await emailOtp.sendVerificationOtp({
        email: parsed.data,
        type: "sign-in",
      });
      if (error) throw new Error(error.message ?? "Couldn't send code");
      return parsed.data;
    },
    onSuccess: (normalized) => {
      setEmail(normalized);
      setStep("verify");
      toast.success(`We sent a code to ${normalized}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verify = useMutation({
    mutationFn: async () => {
      if (!otpSchema.safeParse(otp).success)
        throw new Error("Enter the 6-digit code");
      const { error } = await signIn.emailOtp({ email, otp });
      if (error) throw new Error(error.message ?? "Invalid or expired code");

      // Authorize: the web portal is admin-only.
      const session = await authClient.getSession();
      const role = session.data?.user?.adminRole;
      if (role !== "admin" && role !== "root") {
        await signOut();
        throw new Error("This portal is invite-only. Your account isn't an admin.");
      }
    },
    onSuccess: () => {
      toast.success("Signed in");
      router.replace("/");
      router.refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Admin portal</CardTitle>
        <CardDescription>
          {step === "request"
            ? "Sign in to the ODJ admin portal."
            : `Enter the code we sent to ${email}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {step === "request" ? (
          <>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={method === "email" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setMethod("email")}
              >
                Email
              </Button>
              <Button
                type="button"
                variant={method === "phone" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setMethod("phone")}
              >
                Phone
              </Button>
            </div>

            {method === "phone" ? (
              <p className="text-sm text-muted-foreground">
                Phone login isn&apos;t available yet — please continue with email.
              </p>
            ) : (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendOtp.mutate();
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={sendOtp.isPending}>
                  {sendOtp.isPending ? "Sending…" : "Send code"}
                </Button>
              </form>
            )}
          </>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              verify.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="otp">Verification code</Label>
              <InputOTP
                id="otp"
                maxLength={6}
                value={otp}
                onChange={setOtp}
                pattern={REGEXP_ONLY_DIGITS}
                inputMode="numeric"
                containerClassName="justify-center"
                autoFocus
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} className="size-11 text-base" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button type="submit" disabled={verify.isPending}>
              {verify.isPending ? "Verifying…" : "Verify & sign in"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep("request");
                setOtp("");
              }}
            >
              Use a different email
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
