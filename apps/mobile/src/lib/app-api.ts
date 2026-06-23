import type {
  OnboardingState,
  Category,
  Profession,
  RequirementField,
  WorkerProfileUpdate,
  HirerProfileUpdate,
  Notification,
} from "@odj/shared";
import { API_URL } from "./api";
import { authClient } from "./auth-client";

/**
 * Authenticated client for the mobile app API (`/api/app/*`).
 *
 * The Express backend reads the better-auth session from the request, so each
 * call must carry the session cookie. The `@better-auth/expo` client stores it
 * in secure-store and exposes it via `authClient.getCookie()`, which we attach
 * as the `Cookie` header (see `@better-auth/expo` client docs/types).
 */
async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookie = authClient.getCookie();
  // Only advertise a JSON body when we actually send one. A bodyless POST (e.g.
  // submit) with `Content-Type: application/json` makes Express's body parser try
  // to JSON-parse an empty string and reject the request with a 400.
  const hasBody = init?.body != null;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = (await res.json()) as {
        error?: string;
        issues?: { message?: string }[];
        missing?: string[];
      };
      if (body?.error) message = body.error;
      if (body?.issues?.[0]?.message) message = body.issues[0].message;
      if (body?.missing?.length) {
        message = `Please complete all required fields (${body.missing.length} still missing).`;
      }
    } catch {
      // non-JSON error body — keep the status message
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** TanStack Query key for the onboarding state (SessionGate + wizard resume). */
export const ONBOARDING_STATE_KEY = ["onboarding-state"] as const;

/** TanStack Query key for the in-app notifications list. */
export const NOTIFICATIONS_KEY = ["notifications"] as const;

/** Typed endpoint functions for the onboarding flow. */
export const appApi = {
  me: () => authedFetch<OnboardingState>("/api/app/me"),

  selectRole: (userType: "worker" | "hirer") =>
    authedFetch<OnboardingState>("/api/app/onboarding/role", {
      method: "POST",
      body: JSON.stringify({ userType }),
    }),

  categories: () =>
    authedFetch<{ categories: Category[] }>(
      "/api/app/catalog/categories",
    ).then((r) => r.categories),

  professions: (categoryId: string) =>
    authedFetch<{ professions: Profession[] }>(
      `/api/app/catalog/categories/${categoryId}/professions`,
    ).then((r) => r.professions),

  effectiveRequirements: (professionIds: string[]) =>
    authedFetch<{ fields: RequirementField[] }>(
      `/api/app/catalog/effective-requirements?professionIds=${professionIds.join(",")}`,
    ).then((r) => r.fields),

  saveWorker: (patch: WorkerProfileUpdate) =>
    authedFetch<OnboardingState>("/api/app/worker-profile", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  saveWorkerProfessions: (professionIds: string[]) =>
    authedFetch<OnboardingState>("/api/app/worker-profile/professions", {
      method: "PUT",
      body: JSON.stringify({ professionIds }),
    }),

  submitWorker: () =>
    authedFetch<OnboardingState>("/api/app/worker-profile/submit", {
      method: "POST",
    }),

  saveHirer: (patch: HirerProfileUpdate) =>
    authedFetch<OnboardingState>("/api/app/hirer-profile", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  submitHirer: () =>
    authedFetch<OnboardingState>("/api/app/hirer-profile/submit", {
      method: "POST",
    }),

  notifications: () =>
    authedFetch<{ notifications: Notification[] }>(
      "/api/app/notifications",
    ).then((r) => r.notifications),

  markNotificationRead: (id: string) =>
    authedFetch<void>(`/api/app/notifications/${id}/read`, { method: "POST" }),

  markAllNotificationsRead: () =>
    authedFetch<void>("/api/app/notifications/read-all", { method: "POST" }),
};
