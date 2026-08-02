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
> a `.env` from the app dir, not the monorepo root). The approved-worker
> availability calendar uses `react-native-calendars` (pure-JS, Expo-Go compatible —
> no native module; bundled TS types), and the rates screen uses
> `@react-native-community/slider` (bundled in Expo Go).

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
    │   ├── index.tsx      # root spinner — SessionGate redirects approved users to their tab home
    │   ├── (hirer)/       # approved-hirer tabs: Home / Jobs / Profile
    │   │   ├── _layout.tsx     # Tabs (Home/Jobs/Profile; professions/search/rate-job/worker-profile href:null)
    │   │   ├── index.tsx       # Home tab: active-job banner + pick a category
    │   │   ├── jobs.tsx        # Jobs tab: Active/Completed/Cancelled (<JobList>)
    │   │   ├── profile.tsx     # Profile tab: own rating + notifications + theme + sign out
    │   │   ├── professions.tsx # pick a profession → book (duration step)
    │   │   ├── book.tsx        # §5: rate unit + quantity + est. range → POST /jobs → search
    │   │   ├── search.tsx      # live "searching…" → matched (start OTP) → in_progress (end OTP) → auto-navigates to rate-job on completion
    │   │   ├── rate-job.tsx    # rate the matched worker for a completed job (?jobId)
    │   │   ├── worker-profile.tsx # a matched worker's public profile + rating (?id)
    │   │   └── chat.tsx        # live/read-only chat with the matched worker (?jobId)
    │   ├── (worker)/      # approved-worker tabs: Home / Jobs / Profile
    │   │   ├── _layout.tsx     # Tabs (Home/Jobs/Profile; rates/availability/location/job/rate-job/hirer-profile/chat href:null)
    │   │   ├── home.tsx        # Home tab: Go-online toggle, offers, active-job card
    │   │   ├── jobs.tsx        # Jobs tab: Active/Completed/Cancelled (<JobList>)
    │   │   ├── profile.tsx     # Profile tab: own rating + setup links (rates/availability/location) + notifications + account
    │   │   ├── rates.tsx       # set ₹ rates per profession (slider + input, bounds-validated)
    │   │   ├── availability.tsx# month calendar — mark days off (all / per profession)
    │   │   ├── location.tsx    # high-accuracy precise location capture
    │   │   ├── job.tsx         # active job: map to hirer, Start-work gate, verify start/end OTP → auto-navigates to rate-job on completion
    │   │   ├── rate-job.tsx    # rate the hirer for a completed job (?jobId)
    │   │   ├── hirer-profile.tsx # a worked-for hirer's public profile + rating (?id)
    │   │   └── chat.tsx        # live/read-only chat with the hirer (?jobId)
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
    │   ├── rate-job-screen.tsx # shared rate-job UI (stars + comment), used by both (worker)/rate-job and (hirer)/rate-job
    │   ├── chat-screen.tsx # shared chat UI (bubbles, location pins, composer), used by both (worker)/chat and (hirer)/chat
    │   ├── onboarding/    # wizard layout + field components (image/location/req)
    │   └── ui/            # rnr primitives: text, button, input, otp-input,
    │                      #   card, label, field, select, chips, switch, progress-header, star-rating
    └── lib/
        ├── utils.ts       # cn()
        ├── api.ts         # API_URL + apiFetch() (public endpoints)
        ├── app-api.ts     # authed /api/app client (attaches session cookie) + appApi
        ├── use-onboarding.ts # useOnboardingState() query (GET /api/app/me)
        ├── use-worker.ts  # useWorkerRates/DaysOff/Offers/Job() (worker queries + active job poll)
        ├── use-hirer.ts   # useJob() — polls a hiring job through its live lifecycle
        ├── use-notifications.ts # useNotifications() query (GET /api/app/notifications)
        ├── use-push.ts    # usePushRegistration() + useNotificationTapRouting() (Expo push token + tap deep-linking)
        ├── use-chat.ts    # useChat(jobId) — /ws/chat WebSocket connection + reconnect/backfill, layered on the chat history query cache
        ├── uploadcare.ts  # uploadToUploadcare() — expo-image-picker → Uploadcare CDN
        ├── storage.ts     # cross-platform storage (SecureStore native / localStorage web)
        └── auth-client.ts # better-auth expo client (+ inferAdditionalFields)
```

## src/app/_layout.tsx
- Imports `../global.css`. Loads the **Poppins** brand font via
  `useFonts`, weights 400/500/600/700, and shows a spinner until ready.
  ⚠️ Each weight is imported from its **own subpath**
  (`@expo-google-fonts/poppins/400Regular`), never from the package root: the
  root `index.js` is a barrel that `require()`s all 18 weights, and Metro cannot
  tree-shake asset requires, so importing from it ships every weight (~2.3 MB of
  dead font data). Root `Stack` (headers hidden) wrapped in
  `GestureHandlerRootView` → `SafeAreaProvider` → `<Providers>` → `<SessionGate>`.
- `SessionGate` — watches `useSession()` **and** `useOnboardingState()` (GET
  `/api/app/me`); routes by state: unauthenticated → `(auth)/login`; no role →
  `(auth)/continue`; `status:draft` → `(onboarding)/{worker|hirer}` (resumes at
  the saved step); `status:under_review` → `(onboarding)/under-review`;
  `status:rejected` → `(onboarding)/rejected` (but allows the `edit-worker`/
  `edit-hirer` screens for re-submit); `status:approved` → the role's tab home
  (`(worker)/home` or `(hirer)`). Only redirects on *arrival* (auth/onboarding groups
  or the root `/`), so in-app tab navigation isn't bounced. Routing is driven by the
  profile `status`, not the legacy `onboardingCompleted`/`setupCompletedAt` flags.
  Spinner while session + state load. Also calls `usePushRegistration()` +
  `useNotificationTapRouting(state?.userType)` (see `lib/use-push.ts`).

## src/app/index.tsx
- `HomeScreen` — a transient spinner at `/`. `SessionGate` redirects approved users
  to their role's tab home (`/(worker)/home` or `/(hirer)`); non-approved states are
  routed to auth/onboarding.

## src/app/(worker)/
- `_layout.tsx` — `Tabs` (Home / Jobs / Profile; emoji tab icons themed via
  `useTheme`). rates/availability/location/job/rate-job/hirer-profile/chat are
  `href:null` (push-only).
- `home.tsx` — `WorkerHome` (Home tab): **"Go online"** `Switch` (`appApi.setOnline`,
  seeded from `worker.isOnline`); while online, an "Incoming requests" section polls
  `useWorkerOffers` (3s) with Accept/Decline (accept → `/(worker)/job`). An
  **active-job card** (`useWorkerJob`) links to it.
- `jobs.tsx` — `WorkerJobs` (Jobs tab): `<JobList keyBase="worker">` (Active/Completed/
  Cancelled); active rows → `/job`; not-yet-rated completed rows → `rate-job?jobId`;
  the counterpart (hirer) name on any row → `hirer-profile?id`; a 💬 tap target on any
  row with a `counterpartProfileId` → `chat?jobId` (live if active, read-only history
  after end).
- `profile.tsx` — `WorkerProfile` (Profile tab): own rating (`<StarRating>` read-only
  + avg/count, from `worker.avgRating/ratingCount`) + setup links (rates/availability/
  location, each with a ✓ when done) + `<NotificationsList>` + theme + sign out.
- `job.tsx` — `WorkerJobScreen` (`useWorkerJob`, 3s poll). `<Map>` to the hirer; a
  **💬 Chat** button next to the header → `chat?jobId`; the
  hirer name/profession line is a `Pressable` → `hirer-profile?id`. By status:
  `matched` + !`startRequested` → **"Start work"** (`appApi.requestStart`); then enter
  the start OTP (`OtpInput` → `verifyStart`); `in_progress` → end OTP → `verifyEnd`,
  which on success `router.replace`s straight to `rate-job?jobId` (no intermediate
  "Done" tap); Cancel (`cancelWorkerJob`).
- `rate-job.tsx` — thin wrapper: `<RateJobScreen jobId backHref="/home"
  jobsKeyBase="worker">`.
- `hirer-profile.tsx` — `HirerProfileView` (`?id`): `appApi.hirerProfileView(id)` —
  name, city, read-only `<StarRating>` + avg/count for a hirer this worker has
  actually worked for (backend 404s otherwise).
- `chat.tsx` — thin wrapper: `<ChatScreen jobId myRole="worker">`.

## src/app/(hirer)/
- `_layout.tsx` — `Tabs` (Home / Jobs / Profile; professions/search/rate-job/
  worker-profile/chat are `href:null`).
- `index.tsx` — `HirerBrowse` (Home tab): an **active-job banner** (poll
  `appApi.hirerJobs("active")`) → resume `search`, plus the category list (reuse
  `appApi.categories`) → tap → professions.
- `jobs.tsx` — `HirerJobs` (Jobs tab): `<JobList keyBase="hirer">`; active rows →
  `search?jobId`; not-yet-rated completed rows → `rate-job?jobId`; the counterpart
  (worker) name on any row → `worker-profile?id`; a 💬 tap target on any row with a
  `counterpartProfileId` → `chat?jobId` (live if active, read-only history after end).
- `profile.tsx` — `HirerProfile` (Profile tab): own rating (`<StarRating>` read-only
  + avg/count, from `hirer.avgRating/ratingCount`) + `<NotificationsList>` + theme +
  sign out.
- `professions.tsx` — `HirerProfessions` (`?categoryId`): professions in the category;
  tapping one navigates to `book?categoryId&professionId&professionName`.
- `book.tsx` — `HirerBook` (§5 job pricing): the duration step that fixes how the
  job is priced before searching. `<Segmented>` unit toggle (only units the admin
  enabled — both bounds set — are offered; hidden when only one applies) +
  `QuantityStepper` bounded by `MAX_QUANTITY[unit]`, so it can't produce a value
  `createJobSchema` would reject. Shows an **estimated range** from the admin
  bounds (`formatPaise(rupeesToPaise(min) × qty)` – max), not an exact price:
  every worker sets their own rate, so the real amount is only known once one
  accepts. Reuses the professions query key, so it's served from cache. Then
  `appApi.createJob({ professionId, lat, lng, rateUnit, quantity })` → search.
  Falls back to a "not bookable yet" state when a profession has no price bounds.
- `search.tsx` — `HirerSearch` (`?jobId`): `<Map>` centered on the hirer; `useJob`
  polls every 2s through the lifecycle — "searching…" → matched (worker pin, tap to
  `worker-profile?id`, a **💬 Chat** button → `chat?jobId`, the agreed
  **`amountPaise` + quantity/unit** now that a worker has been priced, + the
  **start code to show** `otpToShow`) → in_progress (**end code to show**) → completed (an effect
  `router.replace`s to `rate-job?jobId` the instant `status` flips, guarded by a ref
  so it fires once) / cancelled, plus "no workers"/"expired". Cancel → `appApi.cancelJob`.
- `rate-job.tsx` — thin wrapper: `<RateJobScreen jobId backHref="/(hirer)"
  jobsKeyBase="hirer">`.
- `worker-profile.tsx` — `WorkerProfileView` (`?id`): `appApi.workerProfileView(id)` —
  photo, name, city, professions, read-only `<StarRating>` + avg/count for a worker
  this hirer has actually matched with (backend 404s otherwise).
- `chat.tsx` — thin wrapper: `<ChatScreen jobId myRole="hirer">`.
- `rates.tsx` — `WorkerRatesScreen`: `useWorkerRates()`; per profession renders only
  admin-enabled units (₹ daily/hourly) as a `@react-native-community/slider` bounded
  to [min,max] synced with a number `Input` + client validation; Save →
  `appApi.saveWorkerRates` (server re-checks bounds) → back.
- `availability.tsx` — `WorkerAvailabilityScreen`: `react-native-calendars`
  `<Calendar>` (themed from `useTheme` tokens) + a scope `Select` (All professions /
  a specific profession); `markedDates` from `useWorkerDaysOff(from,to)` for the
  visible month; tap a day → `appApi.toggleDayOff` + invalidate. `minDate` = today.
  On mount calls `appApi.markAvailabilityReviewed` (flips the dashboard ✓).
- `location.tsx` — `WorkerLocationScreen`: high-accuracy foreground capture
  (`expo-location` `getCurrentPositionAsync({ accuracy: High })`) → `appApi
  .saveWorkerLocation` → invalidates onboarding state; shows stored coords +
  accuracy + a "map preview coming soon" card (the interactive map is Phase 4). No
  reverse-geocode (this is the precise coordinate, vs the onboarding
  `LocationPicker`'s city/state).

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
- `star-rating.tsx` — `StarRating`: 1-5 tap `★`/`☆` input (`OtpInput`'s rating
  counterpart, plain text glyphs — no icon lib); read-only when `onChange` is
  omitted (used to display an existing rating or an aggregate).

## src/components/rate-job-screen.tsx
- `RateJobScreen({ jobId, backHref, jobsKeyBase })` — shared by
  `(worker)/rate-job` and `(hirer)/rate-job`. `useQuery(JOB_RATING_KEY(jobId))` →
  `appApi.jobRating`; if already rated, read-only `<StarRating>` + comment; else
  a `<StarRating>` + optional comment `Field`/`Input` + submit `Button` →
  `useMutation(appApi.submitRating)` → invalidates the rating key + `[jobsKeyBase,
  "jobs"]` (flips the Jobs-tab "Rate →" to "Rated ✓") → `router.replace(backHref)`.

## src/components/chat-screen.tsx (§7)
- `ChatScreen({ jobId, myRole })` — shared by `(worker)/chat` and `(hirer)/chat`.
  A header (back chevron + "🟢 Online"/"typing…"/"Offline" from
  `useChat`'s `otherOnline`/`otherTyping`, measured via `onLayout` for the
  keyboard offset below) sits above the message list: bubbles (right-aligned
  when `senderRole === myRole`), location messages render as a small `<Map>`
  pin; a composer (text `Input` — `onChangeText` also calls `notifyTyping()`
  — + send `Button` + a "📍" share-location button using `expo-location`)
  shown only while `canSend`, replaced by a "This job has ended — chat is
  read-only" note otherwise. `KeyboardAvoidingView behavior="padding"` on
  **both** platforms with an explicit `keyboardVerticalOffset` (header height
  + top safe-area inset) — Android's native `windowSoftInputMode="adjustResize"`
  doesn't auto-resize under edge-to-edge (default since Expo SDK 53), so the
  offset has to be computed in JS rather than relying on the manifest setting.
  Auto-scroll-to-end on new content.

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
  notifications: `notifications`, `markNotificationRead`, `markAllNotificationsRead`,
  `registerPushToken`, and the approved-worker calls: `workerRates`, `saveWorkerRates`,
  `workerDaysOff`, `toggleDayOff`, `saveWorkerLocation`, `markAvailabilityReviewed`,
  `completeSetup`, the matching calls: `setOnline`, `workerOffers`, `acceptOffer`,
  `declineOffer`, `createJob`, `job`, `cancelJob`, the job-lifecycle calls: `workerJob`,
  `requestStart`, `verifyStart`, `verifyEnd`, `cancelWorkerJob`, the job lists:
  `workerJobs(filter)` / `hirerJobs(filter)`, the ratings calls (§8): `jobRating`,
  `submitRating`, `workerProfileView`, `hirerProfileView`, and `chatHistory(jobId)`
  (§7 — history + read-only fallback; live send/receive is the WS connection in
  `lib/use-chat.ts`, not a REST call).
- `ONBOARDING_STATE_KEY` / `NOTIFICATIONS_KEY` / `WORKER_RATES_KEY` /
  `WORKER_DAYS_OFF_KEY` / `WORKER_OFFERS_KEY` / `WORKER_JOB_KEY` / `JOB_KEY` /
  `JOB_RATING_KEY(jobId)` / `WORKER_PROFILE_VIEW_KEY(id)` /
  `HIRER_PROFILE_VIEW_KEY(id)` / `CHAT_KEY(jobId)` — TanStack Query keys.

## src/lib/use-worker.ts
- `useWorkerRates()` — `useQuery` over `appApi.workerRates` (the worker's
  professions + admin bounds + set rates). `useWorkerDaysOff(from,to)` — days off in
  a date range (calendar marking). Both enabled once a session exists; the backend
  further gates on an approved worker profile.

## src/lib/use-onboarding.ts
- `useOnboardingState()` — `useQuery` over `appApi.me` (enabled once a session
  exists, `staleTime: 0`). Read by `SessionGate` and both wizards.

## src/lib/use-notifications.ts
- `useNotifications()` — `useQuery` over `appApi.notifications` (enabled once a
  session exists, polls every 30s). Read by `<NotificationsList>`.

## src/lib/use-push.ts
- `usePushRegistration()` — best-effort: requests notification permission, gets
  this device's Expo push token (`getExpoPushTokenAsync`, needs an EAS dev
  build — Expo Go dropped remote push in SDK 53) and registers it via
  `appApi.registerPushToken`; retries on the next mount if it fails.
- `useNotificationTapRouting(userType)` — routes a tapped push notification to
  the right screen: listens via
  `Notifications.addNotificationResponseReceivedListener`, plus checks
  `getLastNotificationResponseAsync()` on mount for the cold-start case (app
  launched by tapping a notification while killed). `routeForNotification`
  keys off `data.type` (every push's `data` carries `type`, merged in by
  `pushUser` on the backend — see `lib/notifications.ts`) — `job_completed`
  routes the hirer to `/(hirer)/rate-job?jobId=`, `chat_message` routes either
  role to their `chat?jobId=` screen; written to extend as more job events get
  a tap destination.

## src/lib/use-chat.ts (§7)
- `useChat(jobId)` — live chat for one job over `/ws/chat`. History comes from
  `appApi.chatHistory` via TanStack Query (`CHAT_KEY(jobId)`); a `WebSocket`
  layered on top authenticates the handshake with the session cookie
  (`authClient.getCookie()`, passed as an `options.headers.Cookie` — React
  Native's `WebSocket` extends the standard constructor with a third
  `options` argument the DOM lib types don't know about, hence the
  `RNWebSocketCtor` cast) and sends `{type:"join", jobId}` on open. Incoming
  `{type:"message"}` frames push straight into the query cache
  (`qc.setQueryData`); `{type:"joined"}` invalidates the cache once to
  backfill any gap since the last fetch (covers reconnects) and seeds
  `otherOnline` from the response; `{type:"ended"}` flips local `canSend` to
  `false`; `{type:"presence", online}` updates `otherOnline`; `{type:"typing"}`
  flips `otherTyping` true for 3s (cleared early if a `message` frame arrives
  first). `notifyTyping()` sends a `{type:"typing"}` frame, throttled to at
  most once per 2s while the user keeps typing. Reconnects with capped
  exponential backoff (1s→2s→4s→8s→15s) on close/error while the screen is
  mounted — on our own disconnect `otherOnline`/`otherTyping` reset to
  `false` since we can't know the other party's state until the next
  `{type:"joined"}` refreshes it; connects on mount, closes on unmount — no
  global always-on socket. Returns `{ messages, isLoading, canSend, connected,
  otherOnline, otherTyping, sendText, sendLocation, notifyTyping }`.

## src/components/notifications-list.tsx
- `NotificationsList` — renders `useNotifications()`; unread rows highlighted
  (primary border + dot), tapping marks read (`appApi.markNotificationRead`). Now
  shows **account notices only** (verification decisions) — job events are push-only
  (`pushUser`), surfaced by the live job screens + the Jobs tab. Lives in the Profile tab.

## src/components/job-list.tsx
- `JobList` — the Active/Completed/Cancelled list shared by the worker + hirer Jobs
  tabs: a `<Segmented>` filter + rows (profession + counterpart + date + status);
  `fetcher(filter)` supplies the role's jobs; `onOpenActive` makes active rows resume
  the live job; `onRate` makes completed rows with `!ratedByMe` show a "Rate →"
  affordance (rated rows show "Rated ✓" instead); `onViewProfile` makes the
  counterpart's name (any row with a `counterpartProfileId`) its own tap target,
  independent of the row-level action, opening the profile-view screen;
  `onOpenChat` (§7) adds a 💬 tap target (same `counterpartProfileId` gate) that
  opens that job's chat — live if active, read-only history once it's ended.
  Active filter polls every 5s.

## src/components/ui/segmented.tsx
- `Segmented<T>` — iOS-style segmented control (row of pill options, one selected).

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
