import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { API_URL } from "./api";

/**
 * better-auth client for the web app. Points at the Express auth server
 * (`/api/auth/*`). Email-OTP plugin enables passwordless login; full login UI
 * is built in a later milestone.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [emailOTPClient()],
});

export const { signIn, signOut, useSession } = authClient;
