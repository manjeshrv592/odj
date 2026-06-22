import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import {
  emailOTPClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { API_URL } from "./api";
import { storage } from "./storage";

/**
 * better-auth client for the Expo app.
 *
 * - `expoClient` persists the session/cookies in expo-secure-store and wires
 *   the `odj://` deep-link scheme (must match app.json `scheme` and the
 *   backend's trustedOrigins).
 * - Email-OTP plugin enables passwordless login; the login UI lands in a
 *   later milestone.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "odj",
      storagePrefix: "odj",
      storage,
    }),
    emailOTPClient(),
    // Mirrors `user.additionalFields` in the backend (src/auth/index.ts) so
    // `useSession().user` is typed with userType/adminRole/onboardingCompleted.
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

export const { signIn, signOut, useSession, emailOtp } = authClient;
