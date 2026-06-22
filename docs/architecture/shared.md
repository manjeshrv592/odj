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
- `categorySchema` / `Category` — working domain/category shape (id, name, slug,
  description?, isActive). `createCategorySchema` / `CreateCategory` — omit id.
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

> Grows as features land. Prefer generating DB-owned shapes via `drizzle-zod`
> (in backend) and re-exporting refined schemas here.
