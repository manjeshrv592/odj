import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { emailOTPClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "./api";

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
      storage: SecureStore,
    }),
    emailOTPClient(),
  ],
});

export const { signIn, signOut, useSession } = authClient;
