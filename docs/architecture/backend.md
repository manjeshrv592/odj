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
    │   └── require-admin.ts # admin-only guard (better-auth session + adminRole)
    └── routes/
        ├── health.ts   # liveness + readiness endpoints
        └── portal.ts   # admin Portal-users CRUD + invite (/api/portal)
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
  - `/api/health` router; `/api/portal` router; `GET /` info route.

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

## src/db/schema.ts
- Re-exports all `auth-schema` tables.
- `categories` — starter domain table (id uuid, name, slug unique, description,
  isActive, timestamps). Establishes the Drizzle → drizzle-zod pattern.

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
