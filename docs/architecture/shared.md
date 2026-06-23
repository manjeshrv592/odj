# @odj/shared — architecture

**Path:** `packages/shared` · **Role:** single source of truth for zod schemas
and types, imported by backend, web, and mobile. Shipped as TypeScript source
(consumers transpile it).

```
packages/shared/
├── package.json        # exports ".", "./env", "./health", "./domain"
├── tsconfig.json
└── src/
    ├── index.ts        # barrel — re-exports env, health, domain
    ├── env.ts          # environment-variable schemas
    ├── health.ts       # health-check response contracts
    └── domain.ts       # core domain primitives
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
    name, slug, isActive, position). `createProfessionSchema` (name only) /
    `updateProfessionSchema` (name?, isActive?, position? for reorder).
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
    / `WorkerProfile` (full GET shape incl. `professionIds`, `status`, `currentStep`).
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

> Grows as features land. Prefer generating DB-owned shapes via `drizzle-zod`
> (in backend) and re-exporting refined schemas here.
