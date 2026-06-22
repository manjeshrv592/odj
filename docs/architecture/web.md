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
    ├── proxy.ts            # Next 16 middleware (renamed) — optimistic auth redirects
    ├── app/
    │   ├── layout.tsx      # root layout — fonts + <Providers>
    │   ├── globals.css     # Tailwind v4 + shadcn theme tokens
    │   ├── login/          # public login (page.tsx + login-form.tsx)
    │   └── (dashboard)/    # protected admin shell (route group → "/")
    │       ├── layout.tsx  # sidebar shell + server admin guard
    │       ├── page.tsx    # "Dashboard" placeholder
    │       └── portal-users/page.tsx # Portal-users CRUD route
    ├── components/
    │   ├── providers.tsx   # QueryClientProvider + next-themes + <Toaster>
    │   ├── theme-toggle.tsx# light/dark toggle (shadcn Button + lucide icons)
    │   ├── health-status.tsx # backend health card (TanStack Query)
    │   ├── app-sidebar.tsx # admin nav (Dashboard, Portal users) + sign-out
    │   ├── portal-users.tsx# Portal-users table + invite/edit/delete dialogs
    │   └── ui/             # shadcn components (button, input, input-otp, sidebar, table, dialog, …)
    └── lib/
        ├── utils.ts        # cn() — shadcn class merge
        ├── api.ts          # API_URL + apiFetch() (surfaces backend errors, 204-safe)
        ├── auth-client.ts  # better-auth react client (emailOTP + inferAdditionalFields)
        └── auth-server.ts  # getServerSessionUser() + isAdmin() (RSC session check)
```

## src/app/layout.tsx
- Root layout. Loads the **Poppins** brand font via `next/font/google` (weights
  300–700) exposed as `--font-sans` (+ Geist Mono as `--font-mono`), sets metadata,
  wraps `<body>` in `<Providers>`. `<html suppressHydrationWarning>` (next-themes).

## Styling / design tokens
- `app/globals.css` holds the web theme (oklch colors incl. `--primary` +
  `--primary-hover`/`--primary-active` shades, `--radius`, `font-light` body
  default). See **[styling.md](./styling.md)** for the full cross-platform design
  system — change tokens there/in lockstep with mobile, not per element.

## src/proxy.ts
- Next 16 `proxy` (the renamed middleware). Optimistic, cookie-only redirects:
  no session-cookie + private path → `/login`; has cookie + `/login` → `/`. Uses
  `getSessionCookie` (no DB). Authoritative checks live in the dashboard layout.

## src/app/login/
- `page.tsx` — public login page (theme toggle + `<LoginForm>` in `<Suspense>`).
- `login-form.tsx` (client) — Email/Phone choice (phone stubbed); email→OTP step
  machine via `emailOtp.sendVerificationOtp` + `signIn.emailOtp` (the code step
  uses the shadcn `input-otp` segmented field, digits only); post-sign-in
  **authorizes** (non-admins are signed out). Prefills `?invited=` email.

## src/app/(dashboard)/
- `layout.tsx` — protected admin shell. `getServerSessionUser` + `isAdmin`;
  redirects non-admins to `/login`. Renders `SidebarProvider` + `<AppSidebar>` +
  header (sidebar trigger + theme toggle).
- `page.tsx` — "Dashboard" placeholder.
- `portal-users/page.tsx` — renders `<PortalUsers>`.

## src/components/providers.tsx
- `Providers` (client) — `QueryClientProvider` (one client per session) +
  next-themes `ThemeProvider` (attribute="class", default "system", no-FOUC) +
  sonner `<Toaster>`.

## src/components/app-sidebar.tsx
- `AppSidebar` (client) — collapsible nav (Dashboard, Portal users) with active
  state + sign-out (`signOut` → `/login`).

## src/components/portal-users.tsx
- `PortalUsers` (client) — TanStack Query list of `/api/portal/users` with
  invite + delete (confirm dialog). Non-root rows get a `⋯` actions menu with
  **Delete**; the **root** row shows no menu (it can't be deleted).

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
- `authClient` — `createAuthClient({ baseURL: API_URL, plugins: [emailOTPClient(),
  inferAdditionalFields({ user: { userType, adminRole, onboardingCompleted } }) ] })`.
- Re-exports `signIn`, `signOut`, `signUp`, `useSession`, `emailOtp`.

## src/lib/auth-server.ts
- `getServerSessionUser()` — server-side (RSC) session read; forwards cookies to
  the backend `/api/auth/get-session`, validates with `sessionUserSchema`.
- `isAdmin(user)` — true when `adminRole` is `admin` or `root`.

## src/lib/utils.ts
- `cn(...)` — clsx + tailwind-merge (shadcn standard).
