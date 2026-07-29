# ODJ — Running the apps (dev)

How to start developing on each part of the monorepo. For the one-time native
mobile toolchain (JDK, Android SDK, EAS), see **[INFRA_SETUP.md](./INFRA_SETUP.md)**.
For Razorpay / RazorpayX account setup (§5 Payments), see
**[PAYMENTS_SETUP.md](./PAYMENTS_SETUP.md)**.

## Prerequisites

- **Node** + **pnpm** (`npm i -g pnpm`)
- **PostgreSQL** running locally with a database named **`odj`**
- Mobile only: the native dev-build toolchain (JDK 17, Android SDK, a dev build
  installed on your phone) — see INFRA_SETUP.md

## First-time setup

```bash
pnpm install                          # install everything (from repo root)
cp .env.example .env                  # fill in DB/auth/Resend/etc. (git-ignored)
cp apps/mobile/.env.example apps/mobile/.env   # EXPO_PUBLIC_* vars for the app
pnpm --filter @odj/backend db:setup   # create the `odj` DB (if missing) + migrate
```

> Env is split: the **root `.env`** feeds backend + web; the **`apps/mobile/.env`**
> holds the app's `EXPO_PUBLIC_*` vars (Expo only auto-loads a `.env` from the app
> dir). After changing `apps/mobile/.env`, restart Metro with `-c`.

## Run everything at once

```bash
pnpm dev        # turbo: backend (:4000) + web (:3000) + mobile (Metro :8081)
```

## Run a single app

### Backend — Express API (`:4000`)
```bash
pnpm dev:backend
```
Health check: http://localhost:4000/api/health

### Web — Next.js admin (`:3000`)
```bash
pnpm dev:web
```
Open http://localhost:3000

### Mobile — Expo app (dev build)
The native dev build is already installed on your phone, so day-to-day you only
start the Metro dev server, **from `apps/mobile`**:
```bash
cd apps/mobile
npx expo start --dev-client
```
Then open the **ODJ** app on your phone (it connects to Metro; Fast Refresh applies
JS/TSX changes live). The app calls the backend, so keep `pnpm dev:backend` running
too.

- Same-Wi-Fi (or USB) is enough. If it can't connect, see the connection notes in
  INFRA_SETUP.md.
- `pnpm dev:mobile` (from the repo root) also works — it runs Expo inside
  `apps/mobile` for you. Do **not** run `npx expo start` from the repo root (there's
  a stray root `app.json`; running there loads the wrong project).

**When to rebuild the native app** (`npx expo run:android` again) — only when:
- you add/remove a dependency with **native code** (e.g. `react-native-maps`,
  `expo-notifications`),
- you change **native config in `app.json`** (plugins, permissions, keys, bundle id),
- or you **upgrade the Expo SDK**.

Plain JS/TSX edits never need a rebuild — Fast Refresh handles them.

## Database

```bash
pnpm db:generate                      # generate a migration from schema changes
pnpm db:migrate                       # apply pending migrations
pnpm db:studio                        # open Drizzle Studio
pnpm --filter @odj/backend db:setup   # create DB (if missing) + migrate (one-shot)
```

## Quality

```bash
pnpm typecheck    # typecheck all packages
pnpm build        # build all (turbo)
```

## Quick reference

| Task | Command | Where |
| --- | --- | --- |
| Everything | `pnpm dev` | repo root |
| Backend (:4000) | `pnpm dev:backend` | repo root |
| Web (:3000) | `pnpm dev:web` | repo root |
| Mobile (Metro) | `npx expo start --dev-client` | `apps/mobile` |
| Rebuild mobile native | `npx expo run:android` | `apps/mobile` |
| Typecheck | `pnpm typecheck` | repo root |
| New migration | `pnpm db:generate` → `pnpm db:migrate` | repo root |
