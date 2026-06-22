import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { db } from "../db";
import { user, session, account, verification } from "../db/schema";
import { env } from "../env";
import { sendOtpEmail } from "../lib/email";

/**
 * The single better-auth server instance for the whole platform.
 *
 * - Storage: Drizzle adapter over PostgreSQL (`pg` provider).
 * - Login: email OTP only for now (SMS later). New users are auto-created on
 *   first successful OTP sign-in.
 * - Clients: the Next.js web app and the Expo mobile app both point at this
 *   server's `/api/auth/*` routes. The `expo()` plugin enables the mobile
 *   secure-store/deep-link session flow; `trustedOrigins` whitelists them.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  trustedOrigins: [
    env.WEB_ORIGIN,
    `${env.MOBILE_SCHEME}://`,
    "exp://",
    "exp://**",
  ],
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 5, // 5 minutes
      async sendVerificationOTP({ email, otp, type }) {
        await sendOtpEmail({ email, otp, type });
      },
    }),
    expo(),
  ],
});

export type Auth = typeof auth;
