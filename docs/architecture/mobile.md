# @odj/mobile — architecture

**Path:** `apps/mobile` · **Role:** Expo (SDK 56) app for workers & hirers.
expo-router, NativeWind (Tailwind v3), react-native-reusables conventions,
TanStack Query, better-auth Expo client.

> Onboarding adds `expo-image-picker` + `expo-file-system` (photo/file uploads →
> Uploadcare REST upload API via `File.upload` native multipart; the SDK's Blob
> path and `{uri}` FormData aren't RN-compatible on this stack) and `expo-location`
> (city/state autodetect) — pickers + location declare permission strings via
> `app.json` config plugins. The Uploadcare public key is read from
> `EXPO_PUBLIC_UPLOADCARE_PUBLIC_KEY` (in `apps/mobile/.env` — Expo only auto-loads
> a `.env` from the app dir, not the monorepo root).

> Expo is versioned — read `apps/mobile/AGENTS.md` (points at the exact SDK 56
> docs) before writing framework code.

```
apps/mobile/
├── package.json
├── app.json               # expo config — name "ODJ", scheme "odj"
├── babel.config.js        # babel-preset-expo (jsxImportSource nativewind) + nativewind/babel
├── metro.config.js        # monorepo watchFolders + withNativeWind(global.css)
├── tailwind.config.js     # nativewind preset, darkMode class, theme tokens
├── nativewind-env.d.ts    # nativewind types + *.css module decl
├── tsconfig.json
└── src/
    ├── global.css         # @tailwind + shadcn/rnr theme tokens (:root/.dark)
    ├── app/
    │   ├── _layout.tsx    # root Stack + <SessionGate> (auth/onboarding routing)
    │   ├── index.tsx      # approved home — "you're verified" + notifications list
    │   ├── (auth)/        # auth screens group
    │   │   ├── login.tsx    # Email/Phone choice (phone stubbed) → send OTP
    │   │   ├── otp.tsx      # enter OTP → signIn.emailOtp
    │   │   └── continue.tsx # "Continue as" Work/Hire → POST role → wizard
    │   └── (onboarding)/  # worker/hirer onboarding wizards
    │       ├── _layout.tsx       # Stack (headers hidden)
    │       ├── worker.tsx        # worker wizard host (7 steps, per-step save)
    │       ├── hirer.tsx         # hirer wizard host (5 steps, per-step save)
    │       ├── under-review.tsx  # post-submit "under verification" screen
    │       ├── rejected.tsx      # rejection reason + "Update & re-submit"
    │       ├── edit-worker.tsx   # consolidated worker edit (re-submit)
    │       └── edit-hirer.tsx    # consolidated hirer edit (re-submit)
    ├── components/
    │   ├── providers.tsx  # QueryClient + ThemeContext (NativeWind colorScheme)
    │   ├── theme-toggle.tsx # light/dark toggle (Pressable)
    │   ├── health-status.tsx # backend health card (TanStack Query)
    │   ├── notifications-list.tsx # in-app notifications list (tap → mark read)
    │   ├── onboarding/    # wizard layout + field components (image/location/req)
    │   └── ui/            # rnr primitives: text, button, input, otp-input,
    │                      #   card, label, field, select, chips, switch, progress-header
    └── lib/
        ├── utils.ts       # cn()
        ├── api.ts         # API_URL + apiFetch() (public endpoints)
        ├── app-api.ts     # authed /api/app client (attaches session cookie) + appApi
        ├── use-onboarding.ts # useOnboardingState() query (GET /api/app/me)
        ├── use-notifications.ts # useNotifications() query (GET /api/app/notifications)
        ├── uploadcare.ts  # uploadToUploadcare() — expo-image-picker → Uploadcare CDN
        ├── storage.ts     # cross-platform storage (SecureStore native / localStorage web)
        └── auth-client.ts # better-auth expo client (+ inferAdditionalFields)
```

## src/app/_layout.tsx
- Imports `../global.css`. Loads the **Poppins** brand font via
  `useFonts` (`@expo-google-fonts/poppins`, weights 400/500/600/700) and shows a
  spinner until ready. Root `Stack` (headers hidden) wrapped in
  `GestureHandlerRootView` → `SafeAreaProvider` → `<Providers>` → `<SessionGate>`.
- `SessionGate` — watches `useSession()` **and** `useOnboardingState()` (GET
  `/api/app/me`); routes by state: unauthenticated → `(auth)/login`; no role →
  `(auth)/continue`; `status:draft` → `(onboarding)/{worker|hirer}` (resumes at
  the saved step); `status:under_review` → `(onboarding)/under-review`;
  `status:rejected` → `(onboarding)/rejected` (but allows the `edit-worker`/
  `edit-hirer` screens for re-submit); `status:approved` → `index`. Routing is
  driven by the profile `status`, not the legacy `onboardingCompleted` boolean.
  Spinner while session + state load. (Push registration is deferred — see the note
  under `use-notifications.ts`.)

## src/app/index.tsx
- `HomeScreen` — the approved-user home (stub): a "you're verified" state +
  `<NotificationsList>` + `<ThemeToggle>` + a sign-out button (clears the
  onboarding + notifications caches → `(auth)/login`).

## src/app/(auth)/
- `login.tsx` — Email/Phone choice (phone shows the not-available message);
  email → `emailOtp.sendVerificationOtp` then navigates to `otp` with the email.
- `otp.tsx` — enter the 6-digit code → `signIn.emailOtp`; SessionGate routes on.
- `continue.tsx` — "Continue as" Work/Hire: `POST /api/app/onboarding/role`
  (persists `userType` + creates the draft), seeds the onboarding-state cache, and
  routes into that role's wizard. Plus sign-out.

## src/app/(onboarding)/
- `_layout.tsx` — Stack, headers hidden.
- `worker.tsx` — `WorkerWizard`: 7 steps (name → photo → location → skills →
  languages → requirement fields → review). Local form hydrated **once** from
  `GET /api/app/me`; each "Continue" persists the step (`appApi.saveWorker` /
  `saveWorkerProfessions`) and advances `currentStep`; submit → `under-review`.
- `hirer.tsx` — `HirerWizard`: 5 steps (name → photo → location → individual/
  business + org/GST → review). Same per-step save pattern via `appApi.saveHirer`.
- `under-review.tsx` — post-submit "your profile is under verification, we'll
  notify you within 24 hrs" screen + sign-out.
- `rejected.tsx` — shown when an admin rejects: the rejection reason (from
  `state.worker/hirer.rejectionReason`) + "Update & re-submit" → the role's edit
  screen + sign-out.
- `edit-worker.tsx` / `edit-hirer.tsx` — consolidated single-scroll edit screens
  (re-submit flow). Hydrate from `GET /me`, reuse the onboarding field components
  (`ImageField`, `LocationPicker`, `SkillsStep`, `RequirementsStep`, `Chips`,
  `Select`); "Re-submit" PATCHes all fields (+ PUT professions for worker) then
  `submitWorker/Hirer()` → `under_review`.

## src/components/onboarding/
- `wizard-layout.tsx` — `WizardLayout`: safe area + `ProgressHeader` + scroll body
  + pinned footer button (shared step chrome).
- `image-field.tsx` — `ImageField`: pick (gallery/camera via expo-image-picker) →
  `uploadToUploadcare` → CDN url; circle/square. Profile photo + `file` fields.
- `location-picker.tsx` — `LocationPicker`: expo-location permission + reverse-
  geocode to city/state (editable; manual fallback on denial); captures lat/lng.
- `requirement-field.tsx` — `RequirementFieldInput`: renders one `RequirementField`
  by `inputType` (text→Input, select→Select, file→ImageField).
- `worker/skills-step.tsx` — `SkillsStep`: active categories → professions as
  multi-select `Chips` (lifts selected profession ids).
- `worker/requirements-step.tsx` — `RequirementsStep`: fetches the effective field
  set for the chosen professions and renders each via `RequirementFieldInput`.

## src/components/ui/
- `text.tsx` — `Text` + `TextClassContext` (rnr text-style inheritance).
- `button.tsx` — `Button` (cva variants/sizes; styles descendant `Text`).
- `input.tsx` — `Input` (themed `TextInput`).
- `otp-input.tsx` — `OtpInput`: segmented one-time-code field (the mobile
  counterpart to shadcn `input-otp`); a transparent overlay `TextInput` drives
  boxes that highlight the active slot. Used by `(auth)/otp.tsx`.
- `card.tsx` — `Card`: bordered surface (mobile counterpart of web `Card`).
- `label.tsx` / `field.tsx` — `Label` + `Field` (label + required `*` + error/hint
  wrapper) for consistent form layout.
- `select.tsx` — `Select`: single-choice picker (trigger styled like `Input`, opens
  a modal list). For `select` requirement fields + hirer org type.
- `chips.tsx` — `Chips`: multi-select chip group (worker languages + professions).
- `switch.tsx` — `Switch`: themed RN `Switch` (hirer GST toggle).
- `progress-header.tsx` — `ProgressHeader`: "Step n of N" + progress bar + Back.

## src/components/providers.tsx
- `Providers` — `QueryClientProvider` + `ThemeProvider` (Context).
- `useTheme()` — `{ preference, colorScheme, setTheme, toggle }`. Wraps
  NativeWind `useColorScheme`; persists preference in `expo-secure-store`
  (`odj.theme`); restores on mount.
- `ThemePref` — `"light" | "dark" | "system"`.

## src/components/theme-toggle.tsx
- `ThemeToggle` — `Pressable` calling `toggle()` from `useTheme`.

## src/components/health-status.tsx
- `HealthStatus` — `useQuery(["health"])` → `apiFetch("/api/health")`, validated
  with `healthResponseSchema`; API + DB status dots, polls every 10s.

## src/lib/api.ts
- `API_URL` — `EXPO_PUBLIC_API_URL` (default `http://localhost:4000`).
- `apiFetch<T>(path, init?)`.

## src/lib/app-api.ts
- `authedFetch` — fetch wrapper that attaches the session cookie via
  `authClient.getCookie()` as the `Cookie` header (the backend reads the
  better-auth session from the request). Surfaces the JSON `error` message.
- `appApi` — typed functions for the onboarding flow: `me`, `selectRole`,
  `categories`, `professions`, `effectiveRequirements`, `saveWorker`,
  `saveWorkerProfessions`, `submitWorker`, `saveHirer`, `submitHirer`, plus
  notifications: `notifications`, `markNotificationRead`, `markAllNotificationsRead`.
- `ONBOARDING_STATE_KEY` / `NOTIFICATIONS_KEY` — TanStack Query keys.

## src/lib/use-onboarding.ts
- `useOnboardingState()` — `useQuery` over `appApi.me` (enabled once a session
  exists, `staleTime: 0`). Read by `SessionGate` and both wizards.

## src/lib/use-notifications.ts
- `useNotifications()` — `useQuery` over `appApi.notifications` (enabled once a
  session exists, polls every 30s). Read by `<NotificationsList>`.

> **Push deferred:** mobile push (Expo `getExpoPushTokenAsync`) was removed because
> it can't run in Expo Go (SDK 53+) and needs an EAS dev build + projectId. The
> backend push seam stays dormant (`push_tokens` table + `POST /api/app/push-tokens`
> + `sendExpoPush`); re-enable by re-adding `expo-notifications` + a `lib/push.ts`
> that registers the token, once a dev build exists.

## src/components/notifications-list.tsx
- `NotificationsList` — renders `useNotifications()`; unread rows highlighted
  (primary border + dot), tapping marks read (`appApi.markNotificationRead`).

## src/lib/uploadcare.ts
- `uploadToUploadcare(asset)` — `expo-file-system` `new File(uri).upload(...)`
  native multipart POST to Uploadcare's REST upload endpoint (streams the local
  file; avoids RN's Blob/ArrayBuffer and `{uri}` FormData limits); parses the
  returned `{ file }` id → CDN url. `isUploadConfigured()` guards on
  `EXPO_PUBLIC_UPLOADCARE_PUBLIC_KEY`. (Web uses the Uploadcare widget; this is the
  RN equivalent. PDF document picking is deferred — images for now.)

## src/lib/storage.ts
- `storage` / `AppStorage` — cross-platform key/value store: `expo-secure-store`
  on native, `localStorage` on web (SecureStore has no web native module). Exposes
  sync `getItem`/`setItem` (for the better-auth Expo client) + async `*Async`
  (theme persistence). Used by `auth-client.ts` and `providers.tsx`.

## src/lib/auth-client.ts
- `authClient` — `createAuthClient` with `expoClient({ scheme: "odj",
  storagePrefix: "odj", storage })` (the cross-platform `storage` shim) +
  `emailOTPClient()` +
  `inferAdditionalFields({ user: { userType, adminRole, onboardingCompleted } })`.
- Re-exports `signIn`, `signOut`, `useSession`, `emailOtp`.

## src/lib/utils.ts
- `cn(...)` — clsx + tailwind-merge.

## Styling / theming
- NativeWind `className` on RN core components (enabled via babel
  `jsxImportSource`). Tailwind tokens map to CSS variables in `global.css`
  (`bg-background`, `text-foreground`, …). Dark mode = `.dark` class toggled by
  NativeWind `colorScheme`.
- Theme tokens live in `global.css` (hsl colors, `--radius`) and
  `tailwind.config.js` (color/radius mapping + Poppins `fontFamily` per weight).
  See **[styling.md](./styling.md)** for the full cross-platform design system —
  the blue/radius/font values must stay in sync with web; change them in lockstep.
