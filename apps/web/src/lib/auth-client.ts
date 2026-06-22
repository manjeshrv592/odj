import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { API_URL } from "./api";

/**
 * better-auth client for the web app. Points at the Express auth server
 * (`/api/auth/*`).
 *
 * - `emailOTPClient` — passwordless email-OTP sign-in.
 * - `inferAdditionalFields` — teaches the client about ODJ's extra `user`
 *   columns so `useSession().user` is typed with `userType` / `adminRole` /
 *   `onboardingCompleted`. The schema mirrors `user.additionalFields` in the
 *   backend's `src/auth/index.ts` (kept in sync by hand — see that file).
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    emailOTPClient(),
    inferAdditionalFields({
      user: {
        userType: { type: "string", required: false, input: false },
        adminRole: { type: "string", required: false, input: false },
        onboardingCompleted: {
          type: "boolean",
          required: false,
          input: false,
        },
      },
    }),
  ],
});

export const { signIn, signOut, signUp, useSession, emailOtp } = authClient;
