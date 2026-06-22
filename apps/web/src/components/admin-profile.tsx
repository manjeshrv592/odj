"use client";

import { useState } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminProfileUpdateSchema,
  emailSchema,
  otpSchema,
  type PortalUser,
} from "@odj/shared";
import { apiFetch } from "@/lib/api";
import { authClient, useSession } from "@/lib/auth-client";
import { AvatarUploader } from "@/components/avatar-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

/**
 * Admin profile page. Name/phone/avatar update without OTP (PATCH /api/portal/me);
 * email change goes through better-auth's emailOTP flow (OTP sent to the NEW
 * address, current address proven by the session). Reads/refreshes the session
 * via better-auth's reactive `useSession`.
 */
export function AdminProfile() {
  const { data: session, isPending, refetch } = useSession();
  const user = session?.user;

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your name, phone, photo, and sign-in email.
        </p>
      </div>

      {isPending || !user ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <ProfileDetails
            firstName={user.firstName ?? ""}
            lastName={user.lastName ?? ""}
            phone={user.phone ?? ""}
            image={user.image ?? null}
            onSaved={refetch}
          />
          <EmailCard email={user.email} onChanged={refetch} />
        </>
      )}
    </div>
  );
}

/** Name + phone + avatar editor. */
function ProfileDetails({
  firstName: initialFirst,
  lastName: initialLast,
  phone: initialPhone,
  image: initialImage,
  onSaved,
}: {
  firstName: string;
  lastName: string;
  phone: string;
  image: string | null;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [phone, setPhone] = useState(initialPhone);
  const [image, setImage] = useState<string | null>(initialImage);

  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const parsed = adminProfileUpdateSchema.safeParse(patch);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid details");
      }
      return apiFetch<{ user: PortalUser }>("/api/portal/me", {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
    },
    onSuccess: () => {
      toast.success("Profile updated");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials =
    `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal details</CardTitle>
        <CardDescription>Changing these does not require a code.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt="Profile"
              className="size-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-muted text-lg font-medium">
              {initials}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <AvatarUploader
              onChange={(url) => {
                setImage(url);
                if (url) save.mutate({ image: url });
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div>
          <Button
            type="button"
            onClick={() => save.mutate({ firstName, lastName, phone })}
            disabled={save.isPending}
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Email display + OTP-verified email change dialog. */
function EmailCard({
  email,
  onChanged,
}: {
  email: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"request" | "verify">("request");
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");

  // Reset the dialog state on every open/close transition.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    setStep("request");
    setNewEmail("");
    setOtp("");
  }

  const request = useMutation({
    mutationFn: async () => {
      const parsed = emailSchema.safeParse(newEmail);
      if (!parsed.success) throw new Error("Enter a valid email address");
      const { error } = await authClient.emailOtp.requestEmailChange({
        newEmail: parsed.data,
      });
      if (error) throw new Error(error.message ?? "Couldn't send code");
      return parsed.data;
    },
    onSuccess: (normalized) => {
      setNewEmail(normalized);
      setStep("verify");
      toast.success(`We sent a code to ${normalized}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verify = useMutation({
    mutationFn: async () => {
      if (!otpSchema.safeParse(otp).success)
        throw new Error("Enter the 6-digit code");
      const { error } = await authClient.emailOtp.changeEmail({
        newEmail,
        otp,
      });
      if (error) throw new Error(error.message ?? "Invalid or expired code");
    },
    onSuccess: () => {
      toast.success("Email updated");
      setOpen(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-in email</CardTitle>
        <CardDescription>
          Changing your email sends a verification code to the new address.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <span className="text-sm">{email}</span>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger render={<Button variant="outline">Change email</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change email</DialogTitle>
              <DialogDescription>
                {step === "request"
                  ? "Enter your new email. We'll send a 6-digit code to confirm it."
                  : `Enter the code we sent to ${newEmail}.`}
              </DialogDescription>
            </DialogHeader>

            {step === "request" ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  request.mutate();
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="newEmail">New email</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={request.isPending}>
                    {request.isPending ? "Sending…" : "Send code"}
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  verify.mutate();
                }}
              >
                <div className="flex flex-col items-center gap-1.5">
                  <Label htmlFor="emailOtp">Verification code</Label>
                  <InputOTP
                    id="emailOtp"
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
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="size-11 text-base"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-col">
                  <Button type="submit" disabled={verify.isPending}>
                    {verify.isPending ? "Verifying…" : "Verify & update"}
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
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
