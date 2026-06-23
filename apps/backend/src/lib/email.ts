import { Resend } from "resend";
import { env } from "../env";

/** Resend client for transactional email (login OTP codes + admin invites). */
const resend = new Resend(env.RESEND_API_KEY);

const BRAND = "ODJ";
const BRAND_COLOR = "#4f46e5"; // indigo-600

/**
 * Wrap body markup in a minimal, email-client-safe branded shell (inline styles,
 * table-free, system fonts). Shared by every ODJ transactional email so the
 * header/footer stay consistent.
 */
function emailShell(opts: { heading: string; body: string }): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <div style="max-width:480px;margin:0 auto;padding:32px 16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="display:inline-block;font-size:22px;font-weight:700;letter-spacing:2px;color:${BRAND_COLOR};">${BRAND}</span>
      </div>
      <div style="background:#ffffff;border-radius:12px;padding:32px 28px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;">${opts.heading}</h1>
        ${opts.body}
      </div>
      <p style="text-align:center;color:#a1a1aa;font-size:12px;margin-top:24px;">
        You're receiving this because someone used this address on ${BRAND}.
        If this wasn't you, you can safely ignore it.
      </p>
    </div>
  </body>
</html>`;
}

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

  const html = emailShell({
    heading: subject,
    body: `
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#3f3f46;">
        Use the code below to continue. It expires in <strong>5 minutes</strong>.
      </p>
      <div style="text-align:center;margin:8px 0 4px;">
        <span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:10px;padding:14px 20px;background:#f4f4f5;border-radius:10px;color:#18181b;">${otp}</span>
      </div>`,
  });
  const text = `Your ${BRAND} verification code is ${otp}. It expires in 5 minutes.`;

  await send({ to: email, subject, html, text, devLabel: `OTP for ${email}: ${otp}` });
}

/**
 * Send a branded invite/welcome email to a newly invited admin. The CTA links to
 * the web portal's `/login?invited=<email>` so the email is prefilled; the admin
 * then completes the standard email-OTP sign-in to access the pre-created account.
 */
export async function sendAdminInviteEmail(params: {
  email: string;
  inviteUrl: string;
}): Promise<void> {
  const { email, inviteUrl } = params;
  const subject = "You've been invited to the ODJ admin portal";

  const html = emailShell({
    heading: "You've been invited to ODJ",
    body: `
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#3f3f46;">
        You've been added as an administrator on the ${BRAND} platform. Click the
        button below to sign in to the admin portal. We'll email you a one-time
        code to verify it's you.
      </p>
      <div style="text-align:center;margin:24px 0 8px;">
        <a href="${inviteUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">
          Accept invitation
        </a>
      </div>
      <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;">
        Or open this link directly:<br />
        <a href="${inviteUrl}" style="color:${BRAND_COLOR};word-break:break-all;">${inviteUrl}</a>
      </p>`,
  });
  const text = `You've been invited to the ${BRAND} admin portal. Accept your invitation: ${inviteUrl}`;

  await send({
    to: email,
    subject,
    html,
    text,
    devLabel: `Admin invite for ${email}: ${inviteUrl}`,
  });
}

/**
 * Tell a worker/hirer their profile passed verification. Sent on admin approve.
 */
export async function sendProfileApprovedEmail(params: {
  email: string;
  name: string;
}): Promise<void> {
  const { email, name } = params;
  const subject = "Your ODJ profile is verified 🎉";
  const greeting = name?.trim() ? `Hi ${name},` : "Hi,";

  const html = emailShell({
    heading: "You're verified on ODJ",
    body: `
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">${greeting}</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#3f3f46;">
        Good news — your ${BRAND} profile has been reviewed and <strong>approved</strong>.
        You can now open the app and get started.
      </p>`,
  });
  const text = `${greeting}\n\nYour ${BRAND} profile has been approved. Open the app to get started.`;

  await send({
    to: email,
    subject,
    html,
    text,
    devLabel: `Profile approved for ${email}`,
  });
}

/**
 * Tell a worker/hirer their profile was rejected and why. Sent on admin reject;
 * the reason is shown verbatim and the user can fix + re-submit in the app.
 */
export async function sendProfileRejectedEmail(params: {
  email: string;
  name: string;
  reason: string;
}): Promise<void> {
  const { email, name, reason } = params;
  const subject = "Action needed on your ODJ profile";
  const greeting = name?.trim() ? `Hi ${name},` : "Hi,";
  const safeReason = escapeHtml(reason);

  const html = emailShell({
    heading: "Your ODJ profile needs an update",
    body: `
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">${greeting}</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
        We reviewed your ${BRAND} profile and need a few changes before we can
        approve it:
      </p>
      <div style="margin:0 0 20px;padding:12px 16px;background:#f4f4f5;border-radius:8px;border-left:3px solid ${BRAND_COLOR};font-size:14px;line-height:1.6;color:#18181b;white-space:pre-wrap;">${safeReason}</div>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#3f3f46;">
        Open the app, update your details, and re-submit for verification.
      </p>`,
  });
  const text = `${greeting}\n\nYour ${BRAND} profile needs changes before approval:\n\n${reason}\n\nOpen the app to update and re-submit.`;

  await send({
    to: email,
    subject,
    html,
    text,
    devLabel: `Profile rejected for ${email}: ${reason}`,
  });
}

/** Escape user-supplied text before embedding in HTML email markup. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Low-level Resend send with the shared dev fallback: in non-production, a Resend
 * failure (e.g. unverified domain) logs `devLabel` instead of throwing, keeping
 * local flows testable. In production, errors propagate.
 */
async function send(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  devLabel: string;
}): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    if (env.NODE_ENV !== "production") {
      console.warn(
        `[email] Resend failed (${(err as Error).message}). DEV ${params.devLabel}`,
      );
      return;
    }
    throw err;
  }
}
