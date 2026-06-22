# ODJ

A hiring marketplace where workers (drivers, bouncers, maids, …) and hirers
connect. Workers and hirers sign up via the **mobile app**; an **admin web app**
manages categories, document requirements, profile approvals, disputes,
payments, AI-moderated chat, and ratings.

> See [`CLAUDE.md`](./CLAUDE.md) for the full project brief and rules, and
> [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the technical map.

## Monorepo

pnpm + Turborepo. One Express backend serves both clients.

```
apps/
  mobile/    Expo (SDK 56) + expo-router + NativeWind + react-native-reusables
  web/       Next.js (App Router) + Tailwind v4 + shadcn/ui + next-themes
  backend/   Express 5 + better-auth + Drizzle ORM (PostgreSQL)
packages/
  shared/    @odj/shared — zod schemas & types (single source of truth)
```

## Stack

| Concern         | Choice                                              |
| --------------- | --------------------------------------------------- |
| Package manager | pnpm workspaces · Turborepo                         |
| Schemas/types   | zod (v4) in `@odj/shared`                            |
| Auth            | better-auth — email OTP via Resend (SMS later)      |
| Database        | PostgreSQL + Drizzle ORM (`drizzle-zod`, `pg`)      |
| Server state    | TanStack Query (web + React Native)                 |
| UI state/theme  | React Context (+ next-themes web / NativeWind mobile) |

## Getting started

```bash
# 1. Install
pnpm install

# 2. Configure env (repo root)
cp .env.example .env        # then fill DATABASE_URL, BETTER_AUTH_SECRET, RESEND_API_KEY, …

# 3. Database (PostgreSQL must be running)
pnpm --filter @odj/backend db:setup   # creates the `odj` DB + applies migrations

# 4. Run
pnpm dev:backend    # Express API on :4000
pnpm dev:web        # Next.js on :3000
pnpm dev:mobile     # Expo dev server
pnpm dev            # all at once (turbo)
```

## Health checks

- `GET /api/health` — liveness (process up; never fails on a DB blip)
- `GET /api/health/db` — readiness (`SELECT 1`; 200 connected / 503 down)

## Useful scripts

```bash
pnpm typecheck                       # typecheck all packages
pnpm build                           # build all
pnpm --filter @odj/backend db:generate   # generate migration from schema
pnpm --filter @odj/backend db:migrate    # apply migrations
pnpm --filter @odj/backend db:studio     # drizzle studio
```
