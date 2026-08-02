# @odj/shared — architecture

**Path:** `packages/shared` · **Role:** single source of truth for zod schemas
and types, imported by backend, web, and mobile. Shipped as TypeScript source
(consumers transpile it).

```
packages/shared/
├── package.json        # exports ".", "./env", "./health", "./domain"
├── tsconfig.json
└── src/
    ├── index.ts        # barrel — re-exports env, health, domain, payments
    ├── env.ts          # environment-variable schemas
    ├── health.ts       # health-check response contracts
    ├── domain.ts       # core domain primitives
    └── payments.ts     # money primitives + platform-fee split (§5)
```

## src/env.ts

- `backendEnvSchema` — zod object for all backend env vars (PORT, DATABASE_URL,
  BETTER_AUTH_*, RESEND_*, WEB_ORIGIN, MOBILE_SCHEME, NODE_ENV, ROOT_USER_EMAIL).
- `BackendEnv` — inferred type.
- `parseBackendEnv(env)` — validates `process.env`; throws a readable, aggregated
  error listing every missing/invalid var. Node-type-free (stays runtime-agnostic).

## src/health.ts

- `healthStatusSchema` / `HealthStatus` — `"ok" | "degraded" | "error"`.
- `healthResponseSchema` / `HealthResponse` — liveness payload (status, service,
  version, uptimeSeconds, timestamp, db summary).
- `dbHealthSchema` / `DbHealth` — readiness payload (status, database, latencyMs,
  timestamp, error?).

## src/domain.ts

- `userTypeSchema` / `UserType` — `"worker" | "hirer" | "admin"` (marketplace
  identity; stored on `user.userType`). `userRoleSchema` / `UserRole` — back-compat
  alias of the same.
- `adminRoleSchema` / `AdminRole` — `"root" | "admin"` (web-portal sub-role).
- `approvalStatusSchema` / `ApprovalStatus` — `"pending" | "approved" | "rejected"`.
- `slugify(name)` — pure, dependency-free kebab-case slug helper (strips accents,
  lowercases, non-alnum → `-`). Backend layers uniqueness (`-2`, `-3`, …) on top.
- **Catalog taxonomy** (admin-authored; backend `catalog.ts` owns CRUD):
  - `categorySchema` / `Category` — a category (id, name, slug, description?,
    image? icon CDN url, isActive). `createCategorySchema` (name, description?,
    image? — slug auto) / `updateCategorySchema` (all optional, slug re-derives on
    rename).
  - `professionSchema` / `Profession` — a role under one category (id, categoryId,
    name, slug, isActive, position, + the admin price bounds `dailyMin/dailyMax/
    hourlyMin/hourlyMax`, nullable INR ints). `createProfessionSchema` (name only) /
    `updateProfessionSchema` (name?, isActive?, position? for reorder).
  - `updateProfessionPricingSchema` / `UpdateProfessionPricing` — set the four
    price bounds; `superRefine`: each unit both-or-neither + `min ≤ max`, ≥ 0.
- **Requirement fields** (cascading worker questions):
  - `requirementLevelSchema` (`catalog|category|profession`),
    `requirementInputTypeSchema` (`text|file|select`), `allowedFileTypeSchema`
    (`pdf|jpg|jpeg|png`), `requirementOptionSchema` (`{value,label}`).
  - `requirementFieldSchema` / `RequirementField` — a field (id, level,
    categoryId?, professionId?, stable immutable `key`, label, inputType, required,
    options? for select, allowedFileTypes? for file, position, isActive).
  - `createRequirementFieldSchema` / `updateRequirementFieldSchema` — `superRefine`
    rules: select ⇒ ≥1 option, file ⇒ ≥1 file type, level must match target id
    (catalog→none, category→categoryId, profession→professionId). `key` is never
    in the update shape (immutable, so future worker answers stay mapped).
  - `effectiveRequirementsSchema` / `EffectiveRequirements` — a profession's
    cascaded set grouped `{ catalog, category, profession }`, each position-ordered.
- `emailSchema` — email, normalised to lowercase/trimmed.
- `otpSchema` — 6-digit OTP string.
- `phoneSchema` — lenient stored phone (`+`/digits/spaces/()-, 7–20 chars; no SMS
  verification yet).
- `sessionUserSchema` / `SessionUser` — app-facing user projection (id, email,
  name, emailVerified, image?, userType?, adminRole?, onboardingCompleted,
  firstName?, lastName?, phone?).
- `adminProfileUpdateSchema` / `AdminProfileUpdate` — partial own-profile update
  (firstName?, lastName?, phone?, image?) for `PATCH /api/portal/me`.
- `completeOnboardingSchema` / `CompleteOnboarding` — wizard finish payload
  (firstName, lastName, phone required; image optional).
- `inviteAdminSchema` / `InviteAdmin` — `{ email }` (admin invite input).
- `portalUserSchema` / `PortalUser` — admin row for the Portal-users table.
- **Worker/hirer onboarding (mobile wizard):**
  - `profileStatusSchema` / `ProfileStatus` — `draft | under_review | approved |
    rejected` (drives mobile routing; `pending`→`under_review` on submit).
  - `LANGUAGES` (curated `{code,label}[]`, English + major Indian languages) +
    `languageCodeSchema` / `LanguageCode` — worker languages multi-select source.
  - `gstinSchema` — 15-char Indian GSTIN (uppercased, format-validated).
  - `hirerTypeSchema` (`individual|business`), `orgTypeSchema`
    (`pvt_ltd|llp|partnership|proprietorship|other`).
  - `requirementAnswersSchema` / `RequirementAnswers` — `Record<key, string |
    string[]>`; worker answers keyed by each requirement field's stable `key`
    (file answers store the CDN url). Required-coverage is checked server-side.
  - Shared step payloads: `nameStepSchema`, `photoStepSchema`, `locationStepSchema`.
  - Worker: `workerSkillsStepSchema` (≥1 professionId), `workerLanguagesStepSchema`,
    `workerRequirementsStepSchema`, `workerProfileUpdateSchema` (partial per-step
    PATCH), `workerSubmitSchema` (static-field submit guard), `workerProfileSchema`
    / `WorkerProfile` (full GET shape incl. `professionIds`, `status`, `currentStep`,
    + the post-approval setup markers `locationCapturedAt` / `availabilityReviewedAt`
    / `setupCompletedAt`).
  - Hirer: `hirerTypeStepSchema` (business ⇒ orgName; gstRegistered ⇒ valid GSTIN),
    `hirerProfileUpdateSchema`, `hirerSubmitSchema`, `hirerProfileSchema` / `HirerProfile`.
  - `selectRoleSchema` / `SelectRole` — `{ userType: worker|hirer }` (role pick).
  - `onboardingStateSchema` / `OnboardingState` — GET `/api/app/me` shape
    (`userType`, `status`, `currentStep`, `worker?`, `hirer?`) that the mobile
    SessionGate routes on and the wizard hydrates from.
  - `workerProfileSchema` / `hirerProfileSchema` also carry `rejectionReason` (shown
    on the mobile rejected screen).
- **Admin verification (approve/reject):**
  - `profileKindSchema` / `ProfileKind` — `worker | hirer`.
  - `rejectProfileSchema` — `{ reason }` (required, 1–1000 chars).
  - `verificationListItemSchema` / `VerificationListItem` — a queue row (id, type,
    userId, name, city?, state?, photoUrl?, status, submittedAt?).
  - `verificationAnswerSchema` / `VerificationAnswer` — one resolved requirement
    answer (`key`, `label?`, `inputType?`, `value`, `resolved`).
  - `verificationDetailSchema` / `VerificationDetail` — full admin detail: fixed
    fields + `email`, worker `professions`/`languages`/`answers`, hirer business/GST,
    and the reviewer audit (`reviewedAt`, `reviewedByName`, `rejectionReason`).
- **In-app notifications + push:**
  - `notificationTypeSchema` / `NotificationType` — `profile_approved | profile_rejected`
    (extensible).
  - `notificationSchema` / `Notification` — id, type, title, body, read, createdAt, data?.
  - `registerPushTokenSchema` / `RegisterPushToken` — `{ token, platform? }`.
- **Approved-worker pricing / availability / location:**
  - `workerRateRowSchema` / `WorkerRateRow` — one profession on the rates screen
    (name + admin bounds per unit + the worker's current rates).
    `workerRatesViewSchema` / `WorkerRatesView` — `GET /worker/rates` shape.
    `setWorkerRatesSchema` / `SetWorkerRates` — `{ rates: { professionId,
    dailyRate?, hourlyRate? }[] }` (bounds re-checked server-side).
  - `isoDateSchema` — a `YYYY-MM-DD` calendar day. `dayOffScopeSchema` / `DayOffScope`
    — `"all"` | a `professionId`. `dayOffSchema` / `DayOff` (`{ date, professionId|null }`)
    + `daysOffViewSchema` / `DaysOffView` (`GET /worker/days-off`).
    `toggleDayOffSchema` / `ToggleDayOff` — `{ date, scope, off }`.
  - `preciseLocationSchema` / `PreciseLocation` — `{ lat, lng, accuracy? }`
    (`POST /worker/location`; `capturedAt` set server-side).
- **Hiring / matching (jobs + offers):**
  - `setOnlineSchema` `{ online }`; `WorkerProfile` also carries `isOnline`.
  - `jobStatusSchema` (`searching|matched|cancelled|expired|no_workers`),
    `offerStatusSchema` (`pending|accepted|declined|cancelled|expired`).
  - `createJobSchema` `{ professionId, lat, lng, rateUnit, quantity }` (refine:
    `quantity ≤ MAX_QUANTITY[rateUnit]`); `jobViewSchema` / `JobView`
    (`{ id, status, professionId, matchedWorker?, otpToShow?, …jobPricing }`, hirer
    poll — `otpToShow` is the start code while `matched`, the end code while
    `in_progress`).
  - `workerOfferSchema` / `WorkerOffer` (`{ offerId, jobId, professionName, distanceKm,
    createdAt, rateUnit, quantity, amountPaise }`) + `workerOffersViewSchema`. The
    amount is priced from *that worker's own* rate, so they see their earnings
    before accepting.
  - `jobStatusSchema` includes `in_progress` / `completed`. `workerJobViewSchema` /
    `WorkerJobView` (worker's active job — `{ id, status, professionName, hirer:{name,
    lat,lng}, startRequested }`). `verifyOtpSchema` `{ code }` (4 digits).
  - `jobListFilterSchema` (`active|completed|cancelled`), `jobListItemSchema` /
    `JobListItem` (`{ id, status, professionName, counterpartName,
    counterpartProfileId?, createdAt, ratedByMe, amountPaise? }`) + `jobsListViewSchema`
    (worker/hirer Jobs tabs). `counterpartProfileId` is null when no worker ever
    matched (cancelled/expired/no_workers); links a Jobs-tab row to the
    counterpart's profile-view screen.
  - `notificationTypeSchema` extended with `job_offer` / `job_matched` / `job_started` /
    `job_completed` / `job_cancelled` / `job_rated`.
  - `jobViewSchema.matchedWorker` and `workerJobViewSchema.hirer` each carry an
    `id` (profile id) — links to the worker/hirer profile-view screens (§8).
  - `workerProfileSchema` / `hirerProfileSchema` extended with `avgRating`,
    `ratingCount`.
- **Ratings (§8):**
  - `ratingDirectionSchema` / `RatingDirection` — `worker_to_hirer |
    hirer_to_worker` (resolved server-side from job ownership, never
    client-supplied).
  - `submitRatingSchema` / `SubmitRating` — `{ stars: 1-5, comment?: ≤500 chars }`
    (`POST /jobs/:id/rating`).
  - `ratingSchema` / `Rating` — `{ stars, comment?, createdAt }`, a previously
    submitted (immutable) rating.
  - `jobRatingViewSchema` / `JobRatingView` — `GET /jobs/:id/rating` shape:
    `{ job: {id, professionName, counterpartName, status}, canRate, myRating? }`.
  - `workerProfileViewSchema` / `WorkerProfileView` — narrow public profile a
    hirer sees for a matched worker (`GET /hirer/worker/:workerProfileId`):
    `{ id, firstName?, lastName?, photoUrl?, city?, state?, professions,
    avgRating?, ratingCount }`. Deliberately not `workerProfileSchema` (no
    onboarding-internal fields).
  - `hirerProfileViewSchema` / `HirerProfileView` — symmetric, narrower still
    (no business/org fields) (`GET /worker/hirer/:hirerProfileId`).
- **Chat (§7):**
  - `chatSenderRoleSchema` / `ChatSenderRole` — `worker | hirer`, resolved
    server-side from job ownership, never client-supplied.
  - `chatMessageTypeSchema` / `ChatMessageType` — `text | location` (no
    files/images).
  - `chatMessageSchema` / `ChatMessage` — `{ id, senderRole, type, body?,
    lat?, lng?, createdAt }`.
  - `jobChatViewSchema` / `JobChatView` — `GET /jobs/:id/chat` shape:
    `{ messages: ChatMessage[], canSend }`.
  - `sendChatMessageSchema` / `SendChatMessage` — discriminated union on
    `type`: `{type:"text", body: 1-1000 chars}` | `{type:"location", lat, lng}`
    — the payload of a `{type:"send"}` WS frame.
  - `chatWsClientFrameSchema` / `ChatWsClientFrame` — discriminated union of
    the three client→server `/ws/chat` frame shapes (`{type:"join", jobId}` /
    `{type:"send", message}` / `{type:"typing"}`), shared so backend and
    mobile type the wire protocol identically. Server→client frames
    (`joined`/`message`/`ended`/`presence`/`typing`/`error`) aren't zod-shared
    — typed ad-hoc on each side (`ChatWsMessage` in `use-chat.ts`).
  - `notificationTypeSchema` extended with `chat_message`.
- **Job pricing (§5 prerequisite, in `domain.ts`):**
  - `rateUnitSchema` / `RateUnit` — `daily | hourly`. Which of the worker's two
    rates prices a job; a profession only offers a unit when the admin set both
    of its bounds.
  - `MAX_QUANTITY` — `{ daily: 30, hourly: 12 }`; caps a single booking so a
    fat-fingered quantity can't create an absurd charge.
  - `jobPricingSchema` / `JobPricing` — `{ rateUnit, quantity, workerRateRupees?,
    amountPaise? }`, spread into `jobViewSchema` and `workerJobViewSchema`. The
    last two are **snapshots** taken in the accept transaction, so a later rate
    change can't move the price of an agreed job; null on jobs that never matched.

## src/payments.ts

Money primitives for §5. **All money is integer paise** — floats can't represent
`0.1` exactly, and Razorpay's APIs take paise anyway, so paise-in/paise-out
avoids a conversion layer.

- `PAISE_PER_RUPEE` (100), `BPS_DENOMINATOR` (10 000). Fees/taxes are configured
  in **basis points** so a rate like 0.1% (TDS 194-O) is an exact integer (10).
- `rupeesToPaise(rupees)` — whole rupees → paise; throws on a non-integer so a
  stray float can't slip in. Worker rates are stored as whole rupees.
- `formatPaise(paise)` — display string with **en-IN** grouping (`₹1,00,000`, not
  `₹100,000`); shows paise only when there's a remainder.
- `feeConfigSchema` / `FeeConfig` — `{ platformFeeBps, tdsBps, tcsBps }`.
  `DEFAULT_FEE_CONFIG` = 15% platform fee, **0 tax** — TDS (0.1%, above ₹5L/FY)
  and GST TCS (0.5%) default to zero so a CA sets the real values rather than the
  code encoding a guess at tax law. See `PAYMENTS_SETUP.md`.
- `jobSplitSchema` / `JobSplit` + `splitJobAmount(grossPaise, fees)` — the four
  receipt lines. Each deduction is **floored** and `net` is the remainder, so the
  lines always sum back to gross with no orphaned paise and rounding can only
  favour the worker. Deterministic and integer-only, so backend, web and mobile
  always agree on the receipt.

> Grows as features land. Prefer generating DB-owned shapes via `drizzle-zod`
> (in backend) and re-exporting refined schemas here.
