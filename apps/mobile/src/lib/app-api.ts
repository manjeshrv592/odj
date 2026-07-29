import type {
  OnboardingState,
  Category,
  Profession,
  RequirementField,
  WorkerProfileUpdate,
  HirerProfileUpdate,
  Notification,
  WorkerRateRow,
  SetWorkerRates,
  DayOff,
  ToggleDayOff,
  PreciseLocation,
  JobView,
  WorkerOffer,
  CreateJob,
  WorkerJobView,
  JobListItem,
  JobListFilter,
  SubmitRating,
  JobRatingView,
  WorkerProfileView,
  HirerProfileView,
  JobChatView,
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

/** TanStack Query keys for the approved-worker screens. */
export const WORKER_RATES_KEY = ["worker", "rates"] as const;
export const WORKER_DAYS_OFF_KEY = ["worker", "days-off"] as const;
export const WORKER_OFFERS_KEY = ["worker", "offers"] as const;
export const WORKER_JOB_KEY = ["worker", "job"] as const;
export const JOB_KEY = (id: string) => ["job", id] as const;

/** TanStack Query keys for ratings (§8) + the worker/hirer profile-view screens. */
export const JOB_RATING_KEY = (jobId: string) => ["job", jobId, "rating"] as const;
export const WORKER_PROFILE_VIEW_KEY = (id: string) =>
  ["worker-profile-view", id] as const;
export const HIRER_PROFILE_VIEW_KEY = (id: string) =>
  ["hirer-profile-view", id] as const;

/** TanStack Query key for a job's chat history (§7). */
export const CHAT_KEY = (jobId: string) => ["job", jobId, "chat"] as const;

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

  registerPushToken: (token: string, platform?: "ios" | "android" | "web") =>
    authedFetch<void>("/api/app/push-tokens", {
      method: "POST",
      body: JSON.stringify({ token, platform }),
    }),

  // ── Approved-worker: rates, availability, location ──────────────────────────
  workerRates: () =>
    authedFetch<{ rates: WorkerRateRow[] }>("/api/app/worker/rates").then(
      (r) => r.rates,
    ),

  saveWorkerRates: (rates: SetWorkerRates["rates"]) =>
    authedFetch<void>("/api/app/worker/rates", {
      method: "PUT",
      body: JSON.stringify({ rates }),
    }),

  workerDaysOff: (from: string, to: string) =>
    authedFetch<{ daysOff: DayOff[] }>(
      `/api/app/worker/days-off?from=${from}&to=${to}`,
    ).then((r) => r.daysOff),

  toggleDayOff: (input: ToggleDayOff) =>
    authedFetch<void>("/api/app/worker/days-off", {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  saveWorkerLocation: (input: PreciseLocation) =>
    authedFetch<void>("/api/app/worker/location", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  markAvailabilityReviewed: () =>
    authedFetch<void>("/api/app/worker/availability/reviewed", {
      method: "POST",
    }),

  completeSetup: () =>
    authedFetch<void>("/api/app/worker/setup/complete", { method: "POST" }),

  // ── Matching: worker presence + offers ──────────────────────────────────────
  setOnline: (online: boolean) =>
    authedFetch<{ online: boolean }>("/api/app/worker/online", {
      method: "POST",
      body: JSON.stringify({ online }),
    }),

  workerOffers: () =>
    authedFetch<{ offers: WorkerOffer[] }>("/api/app/worker/offers").then(
      (r) => r.offers,
    ),

  acceptOffer: (offerId: string) =>
    authedFetch<{ ok: boolean }>(`/api/app/worker/offers/${offerId}/accept`, {
      method: "POST",
    }),

  declineOffer: (offerId: string) =>
    authedFetch<void>(`/api/app/worker/offers/${offerId}/decline`, {
      method: "POST",
    }),

  // ── Matching: hirer jobs ────────────────────────────────────────────────────
  createJob: (input: CreateJob) =>
    authedFetch<JobView>("/api/app/jobs", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  job: (jobId: string) => authedFetch<JobView>(`/api/app/jobs/${jobId}`),

  cancelJob: (jobId: string) =>
    authedFetch<void>(`/api/app/jobs/${jobId}/cancel`, { method: "POST" }),

  // ── Job lifecycle (worker side) ─────────────────────────────────────────────
  workerJob: () =>
    authedFetch<{ job: WorkerJobView | null }>("/api/app/worker/job").then(
      (r) => r.job,
    ),

  verifyStart: (jobId: string, code: string) =>
    authedFetch<{ status: string }>(`/api/app/worker/job/${jobId}/verify-start`, {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  verifyEnd: (jobId: string, code: string) =>
    authedFetch<{ status: string }>(`/api/app/worker/job/${jobId}/verify-end`, {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  cancelWorkerJob: (jobId: string) =>
    authedFetch<void>(`/api/app/worker/job/${jobId}/cancel`, { method: "POST" }),

  requestStart: (jobId: string) =>
    authedFetch<void>(`/api/app/worker/job/${jobId}/request-start`, {
      method: "POST",
    }),

  workerJobs: (filter: JobListFilter) =>
    authedFetch<{ jobs: JobListItem[] }>(
      `/api/app/worker/jobs?filter=${filter}`,
    ).then((r) => r.jobs),

  hirerJobs: (filter: JobListFilter) =>
    authedFetch<{ jobs: JobListItem[] }>(
      `/api/app/hirer/jobs?filter=${filter}`,
    ).then((r) => r.jobs),

  // ── Ratings (§8) ─────────────────────────────────────────────────────────────
  jobRating: (jobId: string) =>
    authedFetch<JobRatingView>(`/api/app/jobs/${jobId}/rating`),

  submitRating: (jobId: string, input: SubmitRating) =>
    authedFetch<{ ok: boolean }>(`/api/app/jobs/${jobId}/rating`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  workerProfileView: (workerProfileId: string) =>
    authedFetch<WorkerProfileView>(`/api/app/hirer/worker/${workerProfileId}`),

  hirerProfileView: (hirerProfileId: string) =>
    authedFetch<HirerProfileView>(`/api/app/worker/hirer/${hirerProfileId}`),

  // ── Chat (§7) ────────────────────────────────────────────────────────────────
  // Sending happens over the WS connection (see lib/use-chat.ts) — this is
  // history + the read-only fallback once a job has ended.
  chatHistory: (jobId: string) =>
    authedFetch<JobChatView>(`/api/app/jobs/${jobId}/chat`),
};
