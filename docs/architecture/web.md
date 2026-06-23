# @odj/web — architecture

**Path:** `apps/web` · **Role:** Next.js (App Router) admin dashboard + web
client. Tailwind v4, shadcn/ui, next-themes, TanStack Query, better-auth client.

```
apps/web/
├── package.json
├── next.config.ts          # loads root .env (process.loadEnvFile) + reactCompiler + transpilePackages: ["@odj/shared"] + images.remotePatterns (ucarecdn.com)
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
    │       ├── profile/page.tsx # renders <AdminProfile>
    │       ├── verifications/  # admin approve/reject queue
    │       │   ├── page.tsx               # <VerificationsList>
    │       │   └── [type]/[id]/page.tsx   # <VerificationDetail> (await params)
    │       └── catalog/    # catalog drill-down (Catalog → Category → Profession)
    │           ├── page.tsx                         # <CatalogOverview>
    │           ├── [categoryId]/page.tsx            # <CategoryDetail> (await params)
    │           └── [categoryId]/[professionId]/page.tsx # <ProfessionDetail>
    ├── components/
    │   ├── providers.tsx   # QueryClientProvider + next-themes + <Toaster>
    │   ├── theme-toggle.tsx# light/dark toggle (shadcn Button + lucide icons)
    │   ├── health-status.tsx # backend health card (TanStack Query)
    │   ├── app-sidebar.tsx # admin nav (Dashboard, Catalog, Verifications+badge, Portal users, Profile) + sign-out
    │   ├── verifications-list.tsx # verification queue table + type/status filters
    │   ├── verification-detail.tsx # full profile + doc lightbox + approve/reject
    │   ├── portal-users.tsx# Portal-users table + invite/edit/delete dialogs
    │   ├── onboarding-wizard.tsx # 3-step profile-completion wizard (submit once)
    │   ├── admin-profile.tsx # profile page: name/phone/avatar edit + email-change dialog
    │   ├── avatar-uploader.tsx # Uploadcare FileUploaderRegular wrapper (→ CDN url)
    │   ├── catalog-overview.tsx # catalog landing: global requirements + categories grid
    │   ├── category-form-dialog.tsx # create/edit category (+ Uploadcare icon)
    │   ├── category-detail.tsx # professions list (CRUD/reorder) + category requirements
    │   ├── profession-detail.tsx # inherited (read-only) + this profession's fields
    │   ├── requirement-fields-panel.tsx # reusable per-scope requirement-field CRUD
    │   ├── requirement-field-editor.tsx # add/edit field dialog (type-switched inputs)
    │   └── ui/             # shadcn components (button, input, select, checkbox, switch, textarea, sidebar, table, dialog, …)
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
- `catalog/page.tsx` — renders `<CatalogOverview>`.
- `catalog/[categoryId]/page.tsx` — `await params` → `<CategoryDetail>`.
- `catalog/[categoryId]/[professionId]/page.tsx` — `await params` →
  `<ProfessionDetail>`.

## Catalog components (admin web only)
- `catalog-overview.tsx` — Catalog landing: a `level="catalog"` requirement panel
  ("Global requirements") + a categories grid (icon/name/slug) with create/edit/
  delete; cards link to the category page.
- `category-form-dialog.tsx` — create/edit a category; reuses `<AvatarUploader>`
  for the icon. Validates with `create/updateCategorySchema`.
- `category-detail.tsx` — professions list (create, rename, hide/show, reorder
  up/down via `position` swap, delete) + a `level="category"` requirement panel.
- `profession-detail.tsx` — reads `effective-requirements`; shows **Inherited**
  fields read-only, grouped "From Catalog" / "From <Category>", above a
  `level="profession"` requirement panel.
- `requirement-fields-panel.tsx` — **reusable** CRUD list for one scope (`level` +
  `categoryId?`/`professionId?`); add/edit/delete/hide/reorder, TanStack Query keyed
  by scope. Used at all three levels.
- `requirement-field-editor.tsx` — add/edit dialog; switches inputs by type
  (Select for type, options editor for `select`, file-type checkboxes for `file`,
  Required switch). Validates with `create/updateRequirementFieldSchema`.

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
- `AppSidebar` (client) — collapsible nav (Dashboard, Catalog, Verifications,
  Portal users, Profile) with active state + sign-out (`signOut` → `/login`). The
  Verifications row shows a `SidebarMenuBadge` with the pending count, polled every
  30s via TanStack Query (`VERIFICATIONS_COUNT_KEY`, exported for invalidation).

## src/components/verifications-list.tsx
- `VerificationsList` (client) — admin verification queue. Type filter
  (All/Workers/Hirers) + status filter (Pending default/Approved/Rejected/All) via
  shadcn `Select`; a `Table` of rows (avatar, name, type badge, location, status,
  submitted date) linking to the detail page. Polls every 30s.

## src/components/verification-detail.tsx
- `VerificationDetail` (client) — full profile for `{type,id}`: header (photo, name,
  email, status), basics, worker skills/languages + requirement answers (file
  answers open a `Dialog` document lightbox via `<iframe>` + open-in-new-tab), hirer
  business/GST, and a decision banner for already-reviewed profiles. Approve button +
  Reject (`Dialog` with a required reason `Textarea`); `sonner` toasts; on success
  invalidates the queue + `VERIFICATIONS_COUNT_KEY` and routes back to the list.

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
