# @odj/backend — architecture

**Path:** `apps/backend` · **Role:** Express 5 API, better-auth server, and
Drizzle/PostgreSQL data layer. Run with `tsx` via Node `--env-file`.

```
apps/backend/
├── package.json        # scripts: dev/start/typecheck, db:*, auth:generate
├── tsconfig.json
├── drizzle.config.ts   # drizzle-kit config (schema, out=./drizzle, pg)
├── drizzle/            # generated SQL migrations (after db:generate)
└── src/
    ├── index.ts        # entry: start server, graceful shutdown
    ├── app.ts          # createApp() — express app, middleware, routes
    ├── env.ts          # validated env (parseBackendEnv from @odj/shared)
    ├── auth/
    │   └── index.ts    # better-auth instance (emailOTP + drizzle + expo)
    ├── db/
    │   ├── index.ts    # pg Pool + drizzle client (db), schema namespace
    │   ├── schema.ts   # full schema = auth tables + domain tables
    │   └── auth-schema.ts # better-auth tables (user/session/account/verification)
    ├── lib/
    │   └── email.ts    # Resend OTP sender
    └── routes/
        └── health.ts   # liveness + readiness endpoints
```

## src/index.ts
- Entry point. Builds the app via `createApp()`, listens on `env.PORT`, logs the
  routes, and handles `SIGINT`/`SIGTERM` graceful shutdown (closes server + pg pool).

## src/app.ts
- `createApp(): Express` — constructs the app:
  - `cors({ origin: [WEB_ORIGIN], credentials: true })`.
  - Mounts better-auth **before** `express.json()` at `ALL /api/auth/{*any}`
    (Express 5 named wildcard) via `toNodeHandler(auth)`.
  - `express.json()` for everything else.
  - `/api/health` router; `GET /` info route.

## src/env.ts
- `env` — `parseBackendEnv(process.env)`, parsed once at import (fail-fast).

## src/auth/index.ts
- `auth` — the single better-auth server instance:
  - `drizzleAdapter(db, { provider: "pg", schema: {user,session,account,verification} })`.
  - `trustedOrigins`: web origin, `odj://`, `exp://`, `exp://**`.
  - Plugins: `emailOTP` (6-digit, 5-min expiry, sends via `sendOtpEmail`) + `expo()`.
- `Auth` — inferred type.

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
  Mirrors `@better-auth/cli generate` output; regenerate via `pnpm --filter
  @odj/backend auth:generate` if better-auth changes its schema.

## src/lib/email.ts
- `sendOtpEmail({ email, otp, type })` — sends the OTP via Resend. In non-prod,
  logs the OTP to console if Resend fails (keeps local dev unblocked without a
  verified sender domain).

## src/routes/health.ts
- `healthRouter` (mounted at `/api/health`):
  - `GET /` — **liveness**: 200 with `HealthResponse`; includes best-effort `db`
    summary; does not hard-depend on DB.
  - `GET /db` — **readiness**: runs `SELECT 1`; 200 `connected` / 503
    `disconnected` with `DbHealth` (latencyMs, error?).
- `checkDb()` — internal helper, returns `{ ok, latencyMs, error? }`.
