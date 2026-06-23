# @odj/backend — architecture

**Path:** `apps/backend` · **Role:** Express 5 API, better-auth server, and
Drizzle/PostgreSQL data layer. Run with `tsx` via Node `--env-file`.

```
apps/backend/
├── package.json        # scripts: dev/start/typecheck, db:*, auth:generate
├── tsconfig.json
├── drizzle.config.ts   # drizzle-kit config (schema, out=./drizzle, pg); loads root .env
├── drizzle/            # generated SQL migrations (0000_*.sql applied)
├── scripts/
│   └── ensure-db.mjs   # idempotent CREATE DATABASE from DATABASE_URL
└── src/
    ├── index.ts        # entry: start server, graceful shutdown
    ├── app.ts          # createApp() — express app, middleware, routes
    ├── env.ts          # validated env (parseBackendEnv from @odj/shared)
    ├── auth/
    │   └── index.ts    # better-auth instance (emailOTP + drizzle + expo + additionalFields)
    ├── db/
    │   ├── index.ts    # pg Pool + drizzle client (db), schema namespace
    │   ├── schema.ts   # full schema = auth tables + domain tables
    │   ├── auth-schema.ts # better-auth tables (+ ODJ user fields)
    │   └── seed-root.ts   # idempotent root-admin seed (from ROOT_USER_EMAIL)
    ├── lib/
    │   └── email.ts    # Resend HTML emails: OTP + admin invite
    ├── middleware/
    │   ├── require-admin.ts # admin-only guard (better-auth session + adminRole)
    │   └── require-user.ts  # mobile (worker/hirer) guard — session, rejects admins
    └── routes/
        ├── health.ts   # liveness + readiness endpoints
        ├── portal.ts   # admin Portal-users CRUD + invite (/api/portal)
        ├── catalog.ts  # categories/professions/requirement-fields CRUD (/api/portal/catalog)
        └── app.ts      # mobile worker/hirer onboarding API (/api/app)
```

## src/index.ts
- Entry point. Builds the app via `createApp()`, fires `seedRootAdmin()` (non-blocking,
  idempotent), listens on `env.PORT`, logs the routes, and handles `SIGINT`/`SIGTERM`
  graceful shutdown (closes server + pg pool).

## src/app.ts
- `createApp(): Express` — constructs the app:
  - `cors({ origin: [WEB_ORIGIN], credentials: true })`.
  - Mounts better-auth **before** `express.json()` at `ALL /api/auth/{*any}`
    (Express 5 named wildcard) via `toNodeHandler(auth)`.
  - `express.json()` for everything else.
  - `/api/health` router; `/api/portal` router; `/api/portal/catalog` router;
    `/api/app` router; `GET /` info route.
  - Note: `cors` only allows `WEB_ORIGIN`. Native RN fetch isn't CORS-bound (the
    app sends the session cookie directly), so `/api/app` needs no origin change;
    only the Expo **web** preview would be blocked.

## src/env.ts
- `env` — `parseBackendEnv(process.env)`, parsed once at import (fail-fast).

## src/auth/index.ts
- `auth` — the single better-auth server instance:
  - `drizzleAdapter(db, { provider: "pg", schema: {user,session,account,verification} })`.
  - `user.additionalFields`: `userType`, `adminRole` (string, `input:false`),
    `onboardingCompleted` (boolean, default false, `input:false`), and the admin
    profile fields `firstName` / `lastName` / `phone` (string, `input:false`) —
    the ODJ identity + profile model, set server-side only. `name` is kept as the
    derived "first last". Clients mirror these via `inferAdditionalFields` (see
    web/mobile auth-client).
  - `trustedOrigins`: web origin, `odj://`, `exp://`, `exp://**`.
  - Plugins: `emailOTP` (6-digit, 5-min expiry, sends via `sendOtpEmail`;
    `changeEmail: { enabled: true }` → OTP-based email change, code sent to the
    **new** address) + `expo()`. Email change exposes
    `requestEmailChangeEmailOTP` / `changeEmailEmailOTP` (client:
    `emailOtp.requestEmailChange` / `emailOtp.changeEmail`).
- `Auth` — inferred type.

## src/db/seed-root.ts
- `seedRootAdmin()` — idempotent bootstrap of the super-admin from
  `env.ROOT_USER_EMAIL`: inserts a pending `userType:"admin"`, `adminRole:"root"`
  user if absent, else promotes an existing row. Non-fatal (logs on error).

## src/middleware/require-admin.ts
- `requireAdmin(req,res,next)` — admin-only guard. Reads the session via
  `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`; 401 if no
  session, 403 if `adminRole ∉ {root, admin}`, else attaches `req.admin`.
- `AdminContext` — type of the attached admin user (augments `Express.Request`).

## src/middleware/require-user.ts
- `requireUser(req,res,next)` — guard for the mobile app API (`/api/app/*`). Reads
  the better-auth session; 401 if none, 403 if the user is a portal admin
  (`adminRole` set), else attaches `req.appUser` and continues. `userType` may be
  null — a new user reaches the role-selection route before picking Work/Hire.
- `AppUserContext` — shape of the attached user (augments `Express.Request`).

## src/routes/app.ts
- `appRouter` (mounted `/api/app`, all routes behind `requireUser`). The mobile
  worker/hirer onboarding API; mirrors `catalog.ts` (zod validate → `db` →
  projection). Helpers: `effectiveFieldsForProfessions` (active catalog+category+
  profession requirement fields, unioned & de-duped by stable `key`),
  `loadWorkerProfile` / `loadHirerProfile` / `loadOnboardingState` (GET-shaping),
  `requireDraftWorker` / `requireDraftHirer` (owner + editable-status guard).
  - **Catalog reads (active only):** `GET /catalog/categories`,
    `GET /catalog/categories/:id/professions`,
    `GET /catalog/effective-requirements?professionIds=a,b,c` → `{ fields }`.
  - **State + role:** `GET /me` → `OnboardingState` (resume + SessionGate);
    `POST /onboarding/role` — idempotent: writes `user.userType` directly (the
    field is `input:false` on better-auth) + inserts the draft profile (409 on a
    different role).
  - **Worker draft:** `PATCH /worker-profile` (partial per-step save + `currentStep`),
    `PUT /worker-profile/professions` (replace the join rows),
    `POST /worker-profile/submit` (validate static fields + ≥1 profession + required
    requirement answers → `under_review`).
  - **Hirer draft:** `PATCH /hirer-profile`, `POST /hirer-profile/submit`
    (validate static fields + business/GST rules → `under_review`).

## src/routes/portal.ts
- `portalRouter` (mounted `/api/portal`, all routes behind `requireAdmin`):
  - `PATCH /me` — update the **signed-in** admin's own profile (`firstName`,
    `lastName`, `phone`, `image`); re-derives `name` when a name part changes. No
    OTP. Body validated with `adminProfileUpdateSchema`. (Used by the Profile page.)
  - `POST /me/complete-onboarding` — finish the onboarding wizard: write
    first/last/phone (+ optional `image`), derive `name`, set
    `onboardingCompleted=true`. Body validated with `completeOnboardingSchema`.
  - `GET /users` — list portal admins (`userType='admin'`), `PortalUser[]`.
  - `POST /users/invite` — `{ email }`; create/promote a pending admin and email
    the branded invite. Resends for an existing admin; 409 for the root email.
  - `DELETE /users/:id` — remove an admin (blocks root + self-delete).
  - Helper `deriveName(first, last, fallback)` — "first last", falls back to the
    existing name when both parts are empty.
- Email change has **no** route here — it's handled by the better-auth emailOTP
  plugin endpoints (see `src/auth/index.ts`).

## src/db/index.ts
- `pool` — shared `pg.Pool` (max 10).
- `db` — Drizzle client bound to pool + schema.
- `DB` type; re-exports `schema`.

## src/routes/catalog.ts
- `catalogRouter` (mounted `/api/portal/catalog`, all routes behind `requireAdmin`).
  The admin authoring API for the catalog taxonomy + cascading worker requirement
  fields. Mirrors `portal.ts` (zod validate → `db` → `toX()` projection). Helpers:
  `pickUnique` (slug/key collision suffixing), `categorySlugs` / `professionSlugs`
  (scoped slug sets), `scopeWhere` (SQL predicate per requirement level),
  `requirementKeys` / `nextRequirementPosition`.
  - **Categories:** `GET /categories`, `POST /categories` (slug auto from name),
    `GET /categories/:id`, `PATCH /categories/:id` (slug re-derives on rename),
    `DELETE /categories/:id` (hard delete — cascades to professions + fields).
  - **Professions:** `GET|POST /categories/:id/professions`,
    `PATCH /professions/:id` (rename/toggle/reorder via `position`),
    `DELETE /professions/:id`.
  - **Requirement fields:** `GET /requirement-fields?level=&categoryId=&professionId=`,
    `POST /requirement-fields` (generates the stable `key` + position),
    `PATCH /requirement-fields/:id` (key immutable; type-specific extras kept
    consistent with the type), `DELETE /requirement-fields/:id`.
  - **Cascade read:** `GET /professions/:id/effective-requirements` → grouped
    `{ catalog, category, profession }`, each position-ordered (powers the
    profession "Inherited" view; reused by mobile later).

## src/db/schema.ts
- Re-exports all `auth-schema` tables.
- `categories` — a working domain/category (id, name, slug unique, description,
  `image` icon CDN url, isActive, timestamps).
- `professions` — a role under one category (`category_id` FK → categories
  `ON DELETE CASCADE`, name, slug, isActive, `position`, timestamps). Unique index
  on `(category_id, slug)`; index on `category_id`.
- `requirementLevel` / `requirementInputType` — pgEnums.
- `requirement_fields` — admin-authored worker questions for all three levels in
  one table: `level` enum, nullable `category_id` / `profession_id` FKs (both
  `ON DELETE CASCADE`; both null ⇒ catalog level), stable `key`, label, `input_type`,
  required, `options` jsonb (select), `allowed_file_types` jsonb (file), position,
  isActive, timestamps. Indexed on `category_id` and `profession_id`.
- Migrations `0003_*` adds `categories.image`, the two enums, and the `professions`
  + `requirement_fields` tables.
- `profileStatus` / `hirerType` / `orgType` — pgEnums for onboarding profiles.
- `worker_profiles` — one per user (`user_id` unique FK → user, cascade): names,
  `photo_url`, city/state, `lat`/`lng` (double precision), `languages` jsonb,
  `answers` jsonb (`Record<key, string|string[]>`), `status` (`profile_status`,
  default `draft`), `current_step`, `submitted_at`, timestamps.
- `worker_professions` — worker↔profession join (composite PK
  `(worker_profile_id, profession_id)`, both FKs cascade; index on profession).
- `hirer_profiles` — one per user: names, `photo_url`, city/state/lat/lng,
  `hirer_type`, `org_name`, `org_type`, `gst_registered`, `gstin`, `status`,
  `current_step`, `submitted_at`, timestamps.
- Migration `0004_*` adds the three enums + `worker_profiles` /
  `worker_professions` / `hirer_profiles` tables.

## src/db/auth-schema.ts
- better-auth Drizzle tables: `user`, `session`, `account`, `verification`.
  Mirrors `@better-auth/cli generate` output. The `user` table also carries ODJ's
  additional columns: `user_type`, `admin_role`, `onboarding_completed` (migration
  `0001_*`) and the profile columns `first_name`, `last_name`, `phone` (migration
  `0002_*`) — all kept in sync with `auth/index.ts` `additionalFields`.

## src/lib/email.ts
- `sendOtpEmail({ email, otp, type })` — branded **HTML** OTP email (text
  fallback) via Resend.
- `sendAdminInviteEmail({ email, inviteUrl })` — branded admin invite/welcome
  email with a CTA to `WEB_ORIGIN/login?invited=<email>`.
- Internal `emailShell()` (shared header/footer markup) + `send()` (Resend call
  with the non-prod dev fallback: logs instead of throwing when Resend fails).

## scripts/ensure-db.mjs
- Connects to the `postgres` maintenance DB (from `DATABASE_URL`) and
  `CREATE DATABASE` the target if it doesn't exist. Used by `db:ensure`;
  `db:setup` = `db:ensure` + `db:migrate` (one-shot local DB bootstrap).

## src/routes/health.ts
- `healthRouter` (mounted at `/api/health`):
  - `GET /` — **liveness**: 200 with `HealthResponse`; includes best-effort `db`
    summary; does not hard-depend on DB.
  - `GET /db` — **readiness**: runs `SELECT 1`; 200 `connected` / 503
    `disconnected` with `DbHealth` (latencyMs, error?).
- `checkDb()` — internal helper, returns `{ ok, latencyMs, error? }`.
