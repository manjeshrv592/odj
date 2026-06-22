# ODJ — Technical Source of Truth (index)

This is the **map** of the codebase for humans and AI agents. The goal: know
*what file to change and where* without scanning the whole tree.

Rather than one giant file (which rots and is noisy to scan), the technical
reference is split **per package**. This index holds the high-level module map +
shared conventions; each package file holds its own file/function/component map.

## Maintenance rule

> When you add or change a file, function, component, route, table, or env var,
> update the matching per-package doc in the same change. When you finish a
> feature, tick it in [FEATURES.md](./FEATURES.md). Treat these docs as part of
> "done".

## Module map

| Package        | Path            | Role                                                  | Doc |
| -------------- | --------------- | ----------------------------------------------------- | --- |
| `@odj/shared`  | `packages/shared` | zod schemas & types — single source of truth        | [shared.md](./architecture/shared.md) |
| `@odj/backend` | `apps/backend`  | Express API + better-auth server + Drizzle/PostgreSQL | [backend.md](./architecture/backend.md) |
| `@odj/web`     | `apps/web`      | Next.js admin + web client (shadcn, next-themes)      | [web.md](./architecture/web.md) |
| `@odj/mobile`  | `apps/mobile`   | Expo app for workers & hirers (NativeWind, reusables) | [mobile.md](./architecture/mobile.md) |

## How things connect

```
        ┌──────────────┐         ┌──────────────┐
        │  @odj/web     │         │  @odj/mobile  │
        │  (Next.js)    │         │  (Expo)       │
        └──────┬───────┘         └──────┬────────┘
               │  HTTP (fetch + TanStack Query)   │
               │  better-auth client              │
               ▼                                  ▼
            ┌────────────────────────────────────────┐
            │            @odj/backend (Express)        │
            │  /api/health      health/readiness       │
            │  /api/auth/*      better-auth (email OTP) │
            └───────────────┬─────────────────────────┘
                            │ Drizzle ORM (pg)
                            ▼
                     ┌──────────────┐
                     │  PostgreSQL  │  database: odj
                     └──────────────┘

   @odj/shared (zod schemas/types) is imported by all three apps.
```

## Cross-cutting conventions

- **Types/validation:** define once in `@odj/shared` with zod; import everywhere.
  DB-owned shapes can be generated with `drizzle-zod` and refined in shared.
- **State:** TanStack Query for anything server-derived; React Context for UI
  state (theme, etc.). No Redux/Zustand.
- **Theming:** light/dark in both clients. Web = `next-themes` (class strategy);
  mobile = NativeWind `colorScheme` wrapped in a Context, persisted in
  secure-store.
- **Auth:** one better-auth server (backend). Clients use `better-auth/react`
  (web) and `better-auth/react` + `@better-auth/expo` (mobile). Email OTP only.
- **Env:** validated via `@odj/shared` `parseBackendEnv`. Public env vars are
  prefixed `NEXT_PUBLIC_` (web) / `EXPO_PUBLIC_` (mobile).
- **Imports:** path alias `@/*` inside each app; `@odj/shared` for shared code.

## Packages beyond the original brief (approved)

`turbo` (monorepo tasks), `next-themes` (web theming), Drizzle stack
(`drizzle-orm`, `drizzle-kit`, `drizzle-zod`, `pg`), `cors`, `tsx`, NativeWind
(`nativewind` + Tailwind v3) and react-native-reusables deps (`clsx`,
`tailwind-merge`, `class-variance-authority`), plus shadcn's standard companions
on web (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`,
`tw-animate-css`, `@base-ui/react`).
