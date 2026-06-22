import { Resend } from "resend";
import { env } from "../env";

/** Resend client for transactional email (currently: login OTP codes). */
const resend = new Resend(env.RESEND_API_KEY);

/**
 * Send a one-time passcode to `email`. Used by better-auth's emailOTP plugin.
 * In development, if Resend rejects (e.g. unverified domain), the OTP is logged
 * to the console so the flow is still testable without a configured domain.
 */
export async function sendOtpEmail(params: {
  email: string;
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
}): Promise<void> {
  const { email, otp, type } = params;
  const subjects: Record<typeof params.type, string> = {
    "sign-in": "Your ODJ login code",
    "email-verification": "Verify your ODJ email",
    "forget-password": "Reset your ODJ password",
    "change-email": "Confirm your new ODJ email",
  };
  const subject = subjects[type];

  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: email,
      subject,
      text: `Your ODJ verification code is ${otp}. It expires in 5 minutes.`,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    if (env.NODE_ENV !== "production") {
      // Keep local dev unblocked even without a verified sender domain.
      console.warn(
        `[email] Resend failed (${(err as Error).message}). DEV OTP for ${email}: ${otp}`,
      );
      return;
    }
    throw err;
  }
}
