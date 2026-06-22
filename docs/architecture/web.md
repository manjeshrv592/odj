# @odj/web — architecture

**Path:** `apps/web` · **Role:** Next.js (App Router) admin dashboard + web
client. Tailwind v4, shadcn/ui, next-themes, TanStack Query, better-auth client.

```
apps/web/
├── package.json
├── next.config.ts          # reactCompiler + transpilePackages: ["@odj/shared"]
├── components.json         # shadcn config
├── tsconfig.json
└── src/
    ├── app/
    │   ├── layout.tsx      # root layout — fonts + <Providers>
    │   ├── page.tsx        # home — "ODJ web app" + theme toggle + health
    │   └── globals.css     # Tailwind v4 + shadcn theme tokens
    ├── components/
    │   ├── providers.tsx   # QueryClientProvider + next-themes ThemeProvider
    │   ├── theme-toggle.tsx# light/dark toggle (shadcn Button + lucide icons)
    │   ├── health-status.tsx # backend health card (TanStack Query)
    │   └── ui/             # shadcn components (button.tsx, …)
    └── lib/
        ├── utils.ts        # cn() — shadcn class merge
        ├── api.ts          # API_URL + apiFetch()
        └── auth-client.ts  # better-auth react client (emailOTP)
```

## src/app/layout.tsx
- Root layout. Loads Geist fonts, sets metadata, wraps `<body>` in `<Providers>`.
  `<html suppressHydrationWarning>` (required by next-themes).

## src/app/page.tsx
- Home screen. Renders **"ODJ web app"**, a `<ThemeToggle>`, and `<HealthStatus>`.

## src/components/providers.tsx
- `Providers` (client) — `QueryClientProvider` (one client per session) +
  next-themes `ThemeProvider` (attribute="class", default "system", no-FOUC).

## src/components/theme-toggle.tsx
- `ThemeToggle` — toggles light/dark via `useTheme` (next-themes); renders a
  shadcn `Button` with Sun/Moon icons; mount-guarded against SSR mismatch.

## src/components/health-status.tsx
- `HealthStatus` — `useQuery(["health"])` → `apiFetch("/api/health")`, validated
  with `healthResponseSchema`; shows API + DB status dots, polls every 10s.

## src/lib/api.ts
- `API_URL` — `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`).
- `apiFetch<T>(path, init?)` — fetch wrapper, `credentials: "include"`.

## src/lib/auth-client.ts
- `authClient` — `createAuthClient({ baseURL: API_URL, plugins: [emailOTPClient()] })`.
- Re-exports `signIn`, `signOut`, `useSession`.

## src/lib/utils.ts
- `cn(...)` — clsx + tailwind-merge (shadcn standard).
