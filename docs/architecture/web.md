# @odj/web — architecture

**Path:** `apps/web` · **Role:** Next.js (App Router) admin dashboard + web
client. Tailwind v4, shadcn/ui, next-themes, TanStack Query, better-auth client.

```
apps/web/
├── package.json
├── next.config.ts          # loads root .env (process.loadEnvFile) + reactCompiler + transpilePackages: ["@odj/shared"]
├── components.json         # shadcn config
├── tsconfig.json
└── src/
    ├── proxy.ts            # Next 16 middleware (renamed) — optimistic auth redirects
    ├── app/
    │   ├── layout.tsx      # root layout — fonts + <Providers>
    │   ├── globals.css     # Tailwind v4 + shadcn theme tokens
    │   ├── login/          # public login (page.tsx + login-form.tsx)
    │   ├── (onboarding)/   # admin profile-completion gate (route group)
    │   │   ├── layout.tsx  # guard: admin + NOT completed (else → /login or /)
    │   │   └── onboarding/page.tsx # renders <OnboardingWizard> (URL /onboarding)
    │   └── (dashboard)/    # protected admin shell (route group → "/")
    │       ├── layout.tsx  # sidebar shell + server admin guard (+ onboarding redirect)
    │       ├── page.tsx    # "Dashboard" placeholder
    │       ├── portal-users/page.tsx # Portal-users CRUD route
    │       └── profile/page.tsx # renders <AdminProfile>
    ├── components/
    │   ├── providers.tsx   # QueryClientProvider + next-themes + <Toaster>
    │   ├── theme-toggle.tsx# light/dark toggle (shadcn Button + lucide icons)
    │   ├── health-status.tsx # backend health card (TanStack Query)
    │   ├── app-sidebar.tsx # admin nav (Dashboard, Portal users, Profile) + sign-out
    │   ├── portal-users.tsx# Portal-users table + invite/edit/delete dialogs
    │   ├── onboarding-wizard.tsx # 3-step profile-completion wizard (submit once)
    │   ├── admin-profile.tsx # profile page: name/phone/avatar edit + email-change dialog
    │   ├── avatar-uploader.tsx # Uploadcare FileUploaderRegular wrapper (→ CDN url)
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

## src/app/(onboarding)/
- `layout.tsx` — onboarding shell + authoritative guard: non-admin → `/login`;
  already-completed admin → `/`. Minimal centered shell + theme toggle (no
  sidebar). Mutually exclusive with the dashboard guard (no redirect loop).
- `onboarding/page.tsx` — renders `<OnboardingWizard>` at `/onboarding`.

## src/app/(dashboard)/
- `layout.tsx` — protected admin shell. `getServerSessionUser` + `isAdmin`;
  redirects non-admins to `/login` and **incomplete** admins to `/onboarding`.
  Renders `SidebarProvider` + `<AppSidebar>` + header (sidebar trigger + theme
  toggle).
- `page.tsx` — "Dashboard" placeholder.
- `portal-users/page.tsx` — renders `<PortalUsers>`.
- `profile/page.tsx` — renders `<AdminProfile>`.

## src/components/onboarding-wizard.tsx
- `OnboardingWizard` (client) — 3 steps (name → phone → optional avatar) held in
  local state; one TanStack Query mutation on finish →
  `POST /api/portal/me/complete-onboarding` (validated with
  `completeOnboardingSchema`), then `router.replace("/")`.

## src/components/admin-profile.tsx
- `AdminProfile` (client) — reads/refreshes the user via `useSession`. Sub-cards:
  name/phone/avatar editor → `PATCH /api/portal/me` (no OTP); and an email card
  with an OTP email-change dialog using `authClient.emailOtp.requestEmailChange`
  → `emailOtp.changeEmail` (reuses `InputOTP`).

## src/components/avatar-uploader.tsx
- `AvatarUploader` (client) — wraps `FileUploaderRegular` from
  `@uploadcare/react-uploader/next` (single image, `imgOnly`, public key from
  `NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY`); lifts the uploaded `cdnUrl` via `onChange`.
  Renders a config hint if the public key is missing. Keeps Uploadcare's default
  styling (see styling.md).

## src/components/providers.tsx
- `Providers` (client) — `QueryClientProvider` (one client per session) +
  next-themes `ThemeProvider` (attribute="class", default "system", no-FOUC) +
  sonner `<Toaster>`.

## src/components/app-sidebar.tsx
- `AppSidebar` (client) — collapsible nav (Dashboard, Portal users, Profile) with
  active state + sign-out (`signOut` → `/login`).

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
  inferAdditionalFields({ user: { userType, adminRole, onboardingCompleted,
  firstName, lastName, phone } }) ] })`.
- Re-exports `signIn`, `signOut`, `signUp`, `useSession`, `emailOtp` (the last
  also carries `requestEmailChange` / `changeEmail` from the emailOTP plugin).

## src/lib/auth-server.ts
- `getServerSessionUser()` — server-side (RSC) session read; forwards cookies to
  the backend `/api/auth/get-session`, validates with `sessionUserSchema`.
- `isAdmin(user)` — true when `adminRole` is `admin` or `root`.

## src/lib/utils.ts
- `cn(...)` — clsx + tailwind-merge (shadcn standard).
