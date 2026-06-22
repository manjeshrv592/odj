"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { completeOnboardingSchema, type PortalUser } from "@odj/shared";
import { apiFetch } from "@/lib/api";
import { AvatarUploader } from "@/components/avatar-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Step = 1 | 2 | 3;
const TOTAL = 3;

/**
 * Admin profile-completion wizard. Three steps (name → phone → optional avatar),
 * collected in client state and submitted once at finish to
 * `POST /api/portal/me/complete-onboarding`, which flips `onboardingCompleted`.
 * On success we go to the dashboard (the gate now lets us through).
 */
export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState<string | null>(null);

  const finish = useMutation({
    mutationFn: async () => {
      const parsed = completeOnboardingSchema.safeParse({
        firstName,
        lastName,
        phone,
        image,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Check your details");
      }
      return apiFetch<{ user: PortalUser }>("/api/portal/me/complete-onboarding", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
    },
    onSuccess: () => {
      toast.success("Profile completed");
      router.replace("/");
      router.refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nameValid = firstName.trim().length > 0 && lastName.trim().length > 0;
  const phoneValid = phone.trim().length >= 7;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Complete your profile</CardTitle>
        <CardDescription>
          Step {step} of {TOTAL} —{" "}
          {step === 1 ? "Your name" : step === 2 ? "Contact number" : "Profile photo"}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {step === 1 && (
          <form
            id="step-form"
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (nameValid) setStep(2);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
          </form>
        )}

        {step === 2 && (
          <form
            id="step-form"
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (phoneValid) setStep(3);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                autoComplete="tel"
                autoFocus
                required
              />
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Add a profile photo, or skip this step — you can add one later.
            </p>
            <AvatarUploader onChange={setImage} />
            {image && (
              <p className="text-sm text-muted-foreground">Photo added ✓</p>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-2">
        {step > 1 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => (s - 1) as Step)}
          >
            Back
          </Button>
        ) : (
          <span />
        )}

        {step === 1 && (
          <Button type="submit" form="step-form" disabled={!nameValid}>
            Next
          </Button>
        )}
        {step === 2 && (
          <Button type="submit" form="step-form" disabled={!phoneValid}>
            Next
          </Button>
        )}
        {step === 3 && (
          <Button
            type="button"
            onClick={() => finish.mutate()}
            disabled={finish.isPending}
          >
            {finish.isPending ? "Finishing…" : image ? "Finish" : "Skip & finish"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
