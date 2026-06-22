# CLAUDE.md — ODJ project memory

> This file is the durable memory of the project's vision, stack, rules, and
> conventions, captured from the founding brief. Read it first in any session.
> Keep it updated when foundational decisions change.

## 1. What ODJ is

ODJ is a **hiring marketplace**. Two kinds of people use the **mobile app** to sign up:

- **Workers** who want to be hired (e.g. Drivers, Bouncers, Maids, …).
- **Hirers** who want to hire workers.

Hirers search workers, view profiles + ratings, and hire them. An **OTP is
exchanged at the start and end of a job** to verify it really happened.

An **admin web app** runs the platform:

- Defines **working domains/categories** (Driver, Bouncer, Maid, …).
- Defines **which documents** each domain requires.
- **Approves / rejects** worker and hirer profiles after signup.
- Runs a **dispute-resolution** system.
- Handles **payments**: collects payment, takes a **platform fee**, disburses the
  rest to workers.

Cross-cutting features (built incrementally):

- **Chat** for disputes, customer support, and worker↔hirer communication.
- **AI moderation** of chat to keep all communication on-platform (block sharing
  of personal contact details).
- **Ratings** system.

> This is a vague but solid summary; many more features will be layered on. The
> user directs feature work **step by step** — do not build ahead of instructions.

## 2. Architecture

A **pnpm + Turborepo monorepo** with three apps and shared packages. One Express
backend serves both clients (single source of auth + API). PostgreSQL database
named **`odj`**.

```
odj/
├── apps/
│   ├── mobile/    Expo (React Native) app — workers & hirers sign up here
│   ├── web/       Next.js app — admin dashboard + web client
│   └── backend/   Express API + better-auth server + Drizzle/PostgreSQL
└── packages/
    └── shared/    @odj/shared — zod schemas & types (single source of truth)
```

## 3. Tech stack (and exact roles)

| Concern            | Choice                                                        |
| ------------------ | ------------------------------------------------------------- |
| Package manager    | **pnpm** workspaces                                           |
| Monorepo tasks     | **Turborepo** (`turbo.json`)                                  |
| Schemas / types    | **zod** (v4) in `@odj/shared` — single source of truth        |
| Mobile             | **Expo** (SDK 56) + **expo-router**, **NativeWind** (Tailwind)|
| Mobile UI kit      | **react-native-reusables** (shadcn-style) on NativeWind       |
| Web                | **Next.js** (App Router) + **Tailwind v4** + **shadcn/ui**    |
| Backend            | **Express 5**                                                 |
| Database           | **PostgreSQL** + **Drizzle ORM** (`drizzle-zod`, `pg`)        |
| Auth               | **better-auth** — email OTP via **Resend** (SMS later)        |
| Server state       | **TanStack Query** (works in web AND React Native)            |
| UI state / theming | **React Context** (+ next-themes on web, NativeWind on mobile)|
| Email              | **Resend**                                                    |

**Auth model:** one better-auth server lives in the Express backend at
`/api/auth/*`. Web and mobile are **clients** of it. Login is **email OTP only**
for now (no SMS until DLT is set up). New users are auto-created on first OTP
sign-in.

## 4. Hard rules

1. **Do not add libraries** beyond those listed above without explaining why and
   getting approval. "Only listed libraries" is a soft rule — propose, justify,
   then add once approved. (Approved beyond the original brief: `turbo`,
   `next-themes`, Drizzle stack, NativeWind, react-native-reusables, and the
   stack's mandatory companion deps — see `plan` / `docs/ARCHITECTURE.md`.)
2. **No Redux/Zustand.** State = TanStack Query (server) + Context (UI).
3. **Reference up-to-date docs.** React Native/Expo and Next.js ship versioned
   docs; their APIs (auth, routing) have changed. Before writing framework code,
   consult the **installed** version's docs/types (and `apps/mobile/AGENTS.md`,
   which points at the exact Expo SDK docs) rather than relying on memory.
4. **Keep the docs current** (see §5). They are the technical source of truth.

## 5. Documentation system (source of truth)

- **`CLAUDE.md`** (this file) — vision, stack, rules.
- **`docs/ARCHITECTURE.md`** — technical source of truth **index**: module map,
  conventions, and links to per-package docs.
- **`docs/architecture/<pkg>.md`** — per package (`backend`, `web`, `mobile`,
  `shared`): folder tree + every file's exports (functions/components/types) with
  a one-line purpose, so an agent knows *what to change, where* without scanning
  source.
- **`docs/FEATURES.md`** — the full feature roadmap with status.

**Maintenance rule (do this as you code):** when you add or change a
file/function/component, update the matching `docs/architecture/<pkg>.md` entry.
When a feature is completed, tick it in `docs/FEATURES.md`.

## 6. Environment & commands

- Copy `.env.example` → `.env` at the repo root and fill values. `.env` is
  git-ignored and loaded via Node's `--env-file` (no dotenv dependency).
- PostgreSQL must be running with a database named `odj`.

```bash
pnpm install              # install everything (run from repo root)

pnpm dev                  # turbo: run all apps in dev
pnpm dev:backend          # Express API on :4000
pnpm dev:web              # Next.js on :3000
pnpm dev:mobile           # Expo dev server

pnpm typecheck            # typecheck all packages
pnpm build                # build all (turbo)

pnpm db:generate          # drizzle-kit: generate migration from schema
pnpm db:migrate           # apply migrations
pnpm db:studio            # drizzle studio
pnpm --filter @odj/backend db:setup   # create `odj` DB (if missing) + migrate
```

**Status:** the `odj` database is created and migrated; health endpoints return
connected. Email is live — Resend domain `sigtest.website` is verified and a real
test send succeeded (sender `no-reply@sigtest.website`).

**Health checks (backend):** `GET /api/health` (liveness, never fails on DB
blips) and `GET /api/health/db` (readiness — 200 if DB reachable, 503 if not).
```
