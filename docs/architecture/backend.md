# @odj/backend — architecture

**Path:** `apps/backend` · **Role:** Express 5 API, better-auth server, and
Drizzle/PostgreSQL data layer. Run with `tsx` via Node `--env-file`.

```
apps/backend/
├── package.json        # scripts: dev/start/typecheck, db:*, auth:generate
├── tsconfig.json
├── drizzle.config.ts   # drizzle-kit config (schema, out=./drizzle, pg); loads root .env
├── drizzle/            # generated SQL migrations (0000_*.sql applied)
├── scripts/
│   ├── ensure-db.mjs   # idempotent CREATE DATABASE from DATABASE_URL
│   └── seed-demo.ts    # demo/staging catalog + approved online workers (§5 demo)
└── src/
    ├── index.ts        # entry: start server, graceful shutdown
    ├── app.ts          # createApp() — express app, middleware, routes
    ├── env.ts          # validated env (parseBackendEnv from @odj/shared)
    ├── auth/
    │   └── index.ts    # better-auth instance (emailOTP + drizzle + expo + additionalFields)
    ├── db/
    │   ├── index.ts    # pg Pool + drizzle client (db), schema namespace
    │   ├── schema.ts   # full schema = auth tables + domain tables
    │   ├── auth-schema.ts # better-auth tables (+ ODJ user fields)
    │   └── seed-root.ts   # idempotent root-admin seed (from ROOT_USER_EMAIL)
    ├── lib/
    │   ├── email.ts    # Resend HTML emails: OTP + admin invite + verification decisions
    │   ├── push.ts     # Expo Push API sender (no dep; best-effort)
    │   ├── notifications.ts # in-app notification + push fan-out helpers
    │   ├── requirements.ts  # cascading effective requirement fields (shared helper)
    │   ├── chat-hub.ts # in-memory chat room registry (join/leave/broadcast/endRoom)
    │   └── chat-ws.ts  # attachChatServer() — the /ws/chat WebSocket server + resolveChatParty
    ├── middleware/
    │   ├── require-admin.ts # admin-only guard (better-auth session + adminRole)
    │   └── require-user.ts  # mobile (worker/hirer) guard — session, rejects admins
    └── routes/
        ├── health.ts   # liveness + readiness endpoints
        ├── portal.ts   # admin Portal-users CRUD + invite (/api/portal)
        ├── catalog.ts  # categories/professions/requirement-fields CRUD (/api/portal/catalog)
        ├── verifications.ts # admin approve/reject queue (/api/portal/verifications)
        └── app.ts      # mobile worker/hirer onboarding + push/notifications API (/api/app)
```

## src/index.ts
- Entry point. Builds the app via `createApp()`, fires `seedRootAdmin()` (non-blocking,
  idempotent), listens on `env.PORT`, logs the routes, calls `attachChatServer(server)`
  (§7 chat's `/ws/chat` WebSocket server — see `lib/chat-ws.ts`), and handles
  `SIGINT`/`SIGTERM` graceful shutdown (closes server + pg pool).

## src/app.ts
- `createApp(): Express` — constructs the app:
  - `cors({ origin: [WEB_ORIGIN], credentials: true })`.
  - Mounts better-auth **before** `express.json()` at `ALL /api/auth/{*any}`
    (Express 5 named wildcard) via `toNodeHandler(auth)`.
  - `express.json()` for everything else.
  - `/api/health` router; `/api/portal` router; `/api/portal/catalog` router;
    `/api/portal/verifications` router; `/api/app` router; `GET /` info route.
  - Note: `cors` only allows `WEB_ORIGIN`. Native RN fetch isn't CORS-bound (the
    app sends the session cookie directly), so `/api/app` needs no origin change;
    only the Expo **web** preview would be blocked.

## src/env.ts
- `env` — `parseBackendEnv(process.env)`, parsed once at import (fail-fast).

## src/auth/index.ts
- `auth` — the single better-auth server instance:
  - `drizzleAdapter(db, { provider: "pg", schema: {user,session,account,verification} })`.
  - `user.additionalFields`: `userType`, `adminRole` (string, `input:false`),
    `onboardingCompleted` (boolean, default false, `input:false`), and the admin
    profile fields `firstName` / `lastName` / `phone` (string, `input:false`) —
    the ODJ identity + profile model, set server-side only. `name` is kept as the
    derived "first last". Clients mirror these via `inferAdditionalFields` (see
    web/mobile auth-client).
  - `trustedOrigins`: web origin, `odj://`, `exp://`, `exp://**`.
  - Plugins: `emailOTP` (6-digit, 5-min expiry, sends via `sendOtpEmail`;
    `changeEmail: { enabled: true }` → OTP-based email change, code sent to the
    **new** address) + `expo()`. Email change exposes
    `requestEmailChangeEmailOTP` / `changeEmailEmailOTP` (client:
    `emailOtp.requestEmailChange` / `emailOtp.changeEmail`).
- `Auth` — inferred type.

## src/db/seed-root.ts
- `seedRootAdmin()` — idempotent bootstrap of the super-admin from
  `env.ROOT_USER_EMAIL`: inserts a pending `userType:"admin"`, `adminRole:"root"`
  user if absent, else promotes an existing row. Non-fatal (logs on error).

## src/middleware/require-admin.ts
- `requireAdmin(req,res,next)` — admin-only guard. Reads the session via
  `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`; 401 if no
  session, 403 if `adminRole ∉ {root, admin}`, else attaches `req.admin`.
- `AdminContext` — type of the attached admin user (augments `Express.Request`).

## src/middleware/require-user.ts
- `requireUser(req,res,next)` — guard for the mobile app API (`/api/app/*`). Reads
  the better-auth session; 401 if none, 403 if the user is a portal admin
  (`adminRole` set), else attaches `req.appUser` and continues. `userType` may be
  null — a new user reaches the role-selection route before picking Work/Hire.
- `AppUserContext` — shape of the attached user (augments `Express.Request`).

## src/routes/app.ts
- `appRouter` (mounted `/api/app`, all routes behind `requireUser`). The mobile
  worker/hirer onboarding API; mirrors `catalog.ts` (zod validate → `db` →
  projection). Uses `effectiveFieldsForProfessions` from `lib/requirements.ts`.
  Helpers: `loadWorkerProfile` / `loadHirerProfile` (now include `rejectionReason`)
  / `loadOnboardingState` (GET-shaping), `requireEditableWorker` /
  `requireEditableHirer` (owner guard that allows `draft` **or** `rejected` — the
  latter re-enables edits for re-submission; `under_review`/`approved` are locked).
  - **Catalog reads (active only):** `GET /catalog/categories`,
    `GET /catalog/categories/:id/professions`,
    `GET /catalog/effective-requirements?professionIds=a,b,c` → `{ fields }`.
  - **State + role:** `GET /me` → `OnboardingState` (resume + SessionGate);
    `POST /onboarding/role` — idempotent: writes `user.userType` directly (the
    field is `input:false` on better-auth) + inserts the draft profile (409 on a
    different role).
  - **Worker draft:** `PATCH /worker-profile` (partial per-step save + `currentStep`),
    `PUT /worker-profile/professions` (replace the join rows),
    `POST /worker-profile/submit` (validate static fields + ≥1 profession + required
    requirement answers → `under_review`; on re-submit clears
    `rejectionReason`/`reviewedAt`/`reviewedBy`).
  - **Hirer draft:** `PATCH /hirer-profile`, `POST /hirer-profile/submit`
    (validate static fields + business/GST rules → `under_review`; same clear).
  - **Push + notifications:** `POST /push-tokens` (upsert this device's Expo token
    by `token`), `GET /notifications` (newest first), `POST /notifications/:id/read`,
    `POST /notifications/read-all`.
  - **Approved-worker (post-verification):** gated by `requireApprovedWorker`
    (status `approved`, distinct from the draft/rejected `requireEditableWorker`).
    `GET /worker/rates` (the worker's professions joined to `professions` bounds +
    their `worker_profession_rates`), `PUT /worker/rates` (validate each rate is for
    a held profession, a supported unit, and within `[min,max]`; upsert).
    `GET /worker/days-off?from=&to=` + `PUT /worker/days-off` (toggle one day off for
    a scope — `all` ⇒ null `professionId`, else a held profession; NULL-aware
    check-then-insert / delete). `POST /worker/location` (high-accuracy capture →
    overwrite `lat`/`lng` + `location_accuracy` + `location_captured_at`).
    `POST /worker/availability/reviewed` (ack the optional day-off step →
    `availability_reviewed_at`) + `POST /worker/setup/complete` (finish/skip the
    dashboard setup → `setup_completed_at`); both idempotent. `loadWorkerProfile`
    projects these three timestamps for the dashboard checkmarks + home routing.
    Helper `workerProfessionRows(workerProfileId)` joins the worker's professions
    with their admin price bounds.
  - **Matching (hiring flow):** `requireApprovedHirer` guard + `loadJobView(jobId)`
    projection. **Worker:** `POST /worker/online` (`is_online` presence),
    `GET /worker/offers` (pending offers on still-open jobs + Haversine distance +
    the amount priced from the worker's own rate — inner-joins
    `worker_profession_rates`, so an offer they can't price never appears),
    `POST /worker/offers/:id/accept` (**race-safe first-accept-wins**: reads the
    worker's rate for the job's `rate_unit` and refuses with 409 if it vanished
    between offer and accept, rather than creating an unpriceable job; then a tx
    flips the job out of `searching` via a conditional UPDATE, **snapshots
    `worker_rate_rupees` + `amount_paise`**, accepts this offer, cancels the rest,
    pushes `job_matched` to the hirer), `POST /worker/offers/:id/decline`.
    **Hirer:** `POST /jobs` (validates the profession actually offers the requested
    `rateUnit` — both admin bounds set — then finds eligible workers via
    `lib/matching`, creates job + offers, pushes `job_offer` to each),
    `GET /jobs/:id` (poll; lazy-expires stale
    searches; includes `matchedWorker` + `otpToShow` for the current phase),
    `POST /jobs/:id/cancel` (searching/matched/in_progress; notifies the worker).
  - **Job lifecycle (start/end OTP):** on accept the job gets 4-digit `start_otp` +
    `end_otp` (`make4DigitOtp`); the hirer *shows* them, the worker *enters* them. The
    hirer's start code stays hidden until the worker taps **Start work**
    (`POST /worker/job/:id/request-start` sets `start_requested_at`; `loadJobView`
    gates `otpToShow` on it; `workerJobView` exposes `startRequested`).
    `GET /worker/job` (active matched/in_progress job → `workerJobView`),
    `POST /worker/job/:id/verify-start` (requires start requested; code==start_otp →
    `in_progress`, push hirer `job_started`), `POST /worker/job/:id/verify-end` (→
    `completed`, push `job_completed`), `POST /worker/job/:id/cancel`.
    `notifyHirer(hirerProfileId, …)` helper (push-only).
  - **Job lists:** `GET /worker/jobs?filter=active|completed|cancelled` +
    `GET /hirer/jobs?filter=…` → `jobsListView` rows (profession + counterpart name +
    date + status; role-specific status buckets, newest first; completed rows also
    carry `ratedByMe`, via a left-join on `ratings` filtered to the caller's own
    `direction`; every row carries `counterpartProfileId` — the joined
    `hirerProfiles.id`/`workerProfiles.id` — null on the hirer side when no
    worker ever matched).
  - **Ratings (§8):** `resolveRatingParty(job, userId)` — job-history-based (not
    gated on current profile approval), resolves the caller's `direction`
    (`worker_to_hirer` | `hirer_to_worker`) + the ratee's profile id from the
    job's own FKs. `GET /jobs/:id/rating` → `JobRatingView` (`canRate`,
    `myRating`). `POST /jobs/:id/rating` — one-shot (409 on a duplicate
    `(jobId, direction)`, enforced by `ratings`' unique index), only while
    `status === "completed"`; in the same transaction, row-locks
    (`.for("update")`) and updates the ratee's denormalized `avgRating`/
    `ratingCount`, then pushes them `job_rated` ("You've been rated").
    `GET /hirer/worker/:workerProfileId` / `GET /worker/hirer/:hirerProfileId` —
    narrow public profile + rating for a party the caller has an actual `jobs`
    link to (404 otherwise — not a general browse-any-profile endpoint).
    `notifyWorker(workerProfileId, …)` helper, symmetric with `notifyHirer`.
  - **Chat (§7):** `GET /jobs/:id/chat` → `JobChatView` (`messages`,
    `canSend`) — history + the read-only fallback once a job ends; auth via
    `resolveChatParty` (see `lib/chat-ws.ts`). Live send/receive happens over
    `/ws/chat`, not REST — see `lib/chat-hub.ts` / `lib/chat-ws.ts`. The three
    job-ending endpoints above (`verify-end`, worker `job/:id/cancel`, hirer
    `jobs/:id/cancel`) each call `endChatRoom(job.id)` right after flipping
    status, so open chat screens are told to stop accepting input immediately.
  - **Notifications:** job events use `pushUser` (push-only, no persistent row);
    account notices (verification decisions) keep `notifyUser` (push + in-app row).

## src/routes/portal.ts
- `portalRouter` (mounted `/api/portal`, all routes behind `requireAdmin`):
  - `PATCH /me` — update the **signed-in** admin's own profile (`firstName`,
    `lastName`, `phone`, `image`); re-derives `name` when a name part changes. No
    OTP. Body validated with `adminProfileUpdateSchema`. (Used by the Profile page.)
  - `POST /me/complete-onboarding` — finish the onboarding wizard: write
    first/last/phone (+ optional `image`), derive `name`, set
    `onboardingCompleted=true`. Body validated with `completeOnboardingSchema`.
  - `GET /users` — list portal admins (`userType='admin'`), `PortalUser[]`.
  - `POST /users/invite` — `{ email }`; create/promote a pending admin and email
    the branded invite. Resends for an existing admin; 409 for the root email.
  - `DELETE /users/:id` — remove an admin (blocks root + self-delete).
  - Helper `deriveName(first, last, fallback)` — "first last", falls back to the
    existing name when both parts are empty.
- Email change has **no** route here — it's handled by the better-auth emailOTP
  plugin endpoints (see `src/auth/index.ts`).

## src/db/index.ts
- `pool` — shared `pg.Pool` (max 10).
- `db` — Drizzle client bound to pool + schema.
- `DB` type; re-exports `schema`.

## src/routes/catalog.ts
- `catalogRouter` (mounted `/api/portal/catalog`, all routes behind `requireAdmin`).
  The admin authoring API for the catalog taxonomy + cascading worker requirement
  fields. Mirrors `portal.ts` (zod validate → `db` → `toX()` projection). Helpers:
  `pickUnique` (slug/key collision suffixing), `categorySlugs` / `professionSlugs`
  (scoped slug sets), `scopeWhere` (SQL predicate per requirement level),
  `requirementKeys` / `nextRequirementPosition`.
  - **Categories:** `GET /categories`, `POST /categories` (slug auto from name),
    `GET /categories/:id`, `PATCH /categories/:id` (slug re-derives on rename),
    `DELETE /categories/:id` (hard delete — cascades to professions + fields).
  - **Professions:** `GET|POST /categories/:id/professions`,
    `PATCH /professions/:id` (rename/toggle/reorder via `position`),
    `PATCH /professions/:id/pricing` (admin price bounds — daily/hourly min/max,
    INR; both-or-neither + min ≤ max via `updateProfessionPricingSchema`),
    `DELETE /professions/:id`. `toProfession` now projects the four pricing columns.
  - **Requirement fields:** `GET /requirement-fields?level=&categoryId=&professionId=`,
    `POST /requirement-fields` (generates the stable `key` + position),
    `PATCH /requirement-fields/:id` (key immutable; type-specific extras kept
    consistent with the type), `DELETE /requirement-fields/:id`.
  - **Cascade read:** `GET /professions/:id/effective-requirements` → grouped
    `{ catalog, category, profession }`, each position-ordered (powers the
    profession "Inherited" view; reused by mobile later).

## src/routes/verifications.ts
- `verificationsRouter` (mounted `/api/portal/verifications`, behind `requireAdmin`).
  Admin profile-verification queue + decisions. Helpers: `parseStatusFilter` /
  `parseTypeFilter`, `displayName`, `loadProfile`, `applicantContact`, `reviewerName`.
  - `GET /?type=worker|hirer|all&status=under_review|approved|rejected|all` →
    `{ verifications: VerificationListItem[] }` (joined to `user` for name/email,
    newest `submittedAt` first; default type `all`, status `under_review`).
  - `GET /count` → `{ pending }` = `under_review` total across both tables (sidebar
    badge).
  - `GET /:type/:id` → `VerificationDetail`. Worker answers are resolved against
    `effectiveFieldsForProfessions` (stored `key` → `{label,inputType,value}`; a
    since-removed field is surfaced with `resolved:false`); language codes → labels.
  - `POST /:type/:id/approve` / `POST /:type/:id/reject` `{ reason }` — only from
    `under_review` (409 otherwise); set status + `reviewedAt`/`reviewedBy`
    (+`rejectionReason`), then email (`sendProfileApproved/RejectedEmail`) +
    `notifyUser` (in-app + Expo push).

## src/lib/requirements.ts
- `toRequirementField(row)` — project a `requirement_fields` row to the shared shape.
- `effectiveFieldsForProfessions(professionIds)` — active catalog+category+profession
  requirement fields, unioned & de-duped by stable `key` (catalog→category→profession,
  then position). Shared by `routes/app.ts` (onboarding) and `routes/verifications.ts`
  (answer-label resolution). Extracted from the old local copy in `app.ts`.

## src/lib/push.ts
- `sendExpoPush(tokens, { title, body, data? })` — POSTs to the Expo Push API
  (`https://exp.host/--/api/v2/push/send`, chunked at 100; skips non-`Expo…PushToken`
  strings). No dependency; best-effort (logs, never throws).
- **Dormant seam:** mobile push registration is currently deferred (no dev build),
  so `push_tokens` stays empty and `notifyUser` → `sendExpoPush` is a no-op. The
  `POST /api/app/push-tokens` endpoint + this sender are ready for when a mobile dev
  build re-adds token registration. The in-app `notifications` path works regardless.

## src/lib/notifications.ts
- `createNotification(userId, input)` — persist one in-app `notifications` row.
- `pushUser(userId, input)` — **push only** (no row), for transient job events shown by
  live screens + the job lists (keeps the notifications list uncluttered). The push
  payload's `data` always includes `type` (merged in from `input.type`, not just
  `input.data`) so the client can route a tapped notification without a separate
  lookup — see mobile's `useNotificationTapRouting`.
- `notifyUser(userId, input)` — create the row **and** `pushUser`. For account notices
  (verification decisions) that belong in the persistent list. Email is sent separately.

## src/lib/chat-hub.ts (§7)
- In-memory chat room registry — `Map<jobId, Set<{ws, userId}>>`.
  Single-process only: correct at the current one-instance deployment; would
  need a shared pub/sub (e.g. Redis) if the backend is ever horizontally
  scaled, since a broadcast only reaches sockets on the same process.
- `join(jobId, ws, userId)` / `leave(jobId, ws)` — room membership.
- `broadcast(jobId, frame, exclude?)` — JSON-serializes and sends to every
  open socket in the room; `exclude` (the sender) skips one socket — used for
  presence/typing frames, which are inherently "about the other party" so the
  sender never needs its own echo.
- `isUserConnected(jobId, userId)` — used by `chat-ws.ts` to skip a "new
  message" push when the recipient is already looking at the open chat.
- `endRoom(jobId)` — broadcasts `{type:"ended"}` to everyone still connected
  when a job reaches a terminal status (called from `app.ts`'s job-ending
  endpoints). A live nudge only — `send` frames are always re-validated
  against the job's current DB status in `chat-ws.ts`, not this broadcast.

## src/lib/chat-ws.ts (§7)
- `resolveChatParty(job, userId)` — job-history-based (like ratings'
  `resolveRatingParty`): resolves the caller's `senderRole` for a job plus
  the other party's `userId` (for the push), or `null` if the caller wasn't a
  party to it. No status gate — read access covers any job the caller was
  ever part of; exported for reuse by the `GET .../chat` REST endpoint.
- `CHAT_ACTIVE_STATUSES` — `{"matched", "in_progress"}`, the live-chat window;
  also exported and reused by the REST endpoint's `canSend`.
- `attachChatServer(httpServer)` — creates a `ws` `WebSocketServer({
  noServer: true })` and handles the HTTP `upgrade` event manually: filters
  to `/ws/chat`, authenticates via the same better-auth session lookup
  `requireUser` uses (`auth.api.getSession` against the request's `Cookie`
  header — rejects with a raw `401` before completing the handshake if no
  session or the user is an admin), then `wss.handleUpgrade`. Per connection:
  a `{type:"join", jobId}` client frame resolves the party, registers the
  socket in `chat-hub`, replies `{type:"joined", canSend, otherOnline}`
  (`otherOnline` from `chatHub.isUserConnected` at join time), and
  broadcasts `{type:"presence", online:true}` to the rest of the room
  (excluding the joiner). A `{type:"typing"}` frame rebroadcasts
  `{type:"typing"}` to the rest of the room (ephemeral — not persisted,
  client-throttled to ~1/2s). A `{type:"send", message}` frame re-fetches the
  job's live status (never trusts the joined-time snapshot), inserts into
  `chat_messages`, broadcasts `{type:"message", message}`, and — only if the
  other party isn't currently connected to that room — `pushUser`s them a
  `chat_message` notification. On disconnect, broadcasts
  `{type:"presence", online:false}` once this was the user's *last* socket in
  the room (multi-device aware). Ping/pong heartbeat (30s) prunes dead sockets.

## src/lib/matching.ts
- `findEligibleWorkers(professionId, lat, lng, radiusKm, unit)` — Haversine SQL
  selecting **approved + online** workers who hold the profession, have a location,
  aren't off today (`worker_days_off`), **and have a rate set for `unit`**
  (`"daily" | "hourly"`), within radius; nearest first. Returns `rateRupees` per
  worker. The rate join is what makes §5 possible: a worker with no rate for the
  requested unit can't be priced, so offering them the job would create a job
  nobody can be charged for — excluding them here keeps that failure out of the
  worker's face rather than surfacing it at accept.
- `haversineKm(aLat,aLng,bLat,bLng)` — JS great-circle distance (offer distances).
- `DEFAULT_RADIUS_KM` — the fixed 15 km search radius (MVP).

## src/db/schema.ts
- Re-exports all `auth-schema` tables.
- `categories` — a working domain/category (id, name, slug unique, description,
  `image` icon CDN url, isActive, timestamps).
- `professions` — a role under one category (`category_id` FK → categories
  `ON DELETE CASCADE`, name, slug, isActive, `position`, timestamps). Unique index
  on `(category_id, slug)`; index on `category_id`. Also carries the admin price
  bounds `daily_min`/`daily_max`/`hourly_min`/`hourly_max` (nullable integer, INR
  whole rupees; a unit is "supported" only when both its min & max are set).
- `requirementLevel` / `requirementInputType` — pgEnums.
- `requirement_fields` — admin-authored worker questions for all three levels in
  one table: `level` enum, nullable `category_id` / `profession_id` FKs (both
  `ON DELETE CASCADE`; both null ⇒ catalog level), stable `key`, label, `input_type`,
  required, `options` jsonb (select), `allowed_file_types` jsonb (file), position,
  isActive, timestamps. Indexed on `category_id` and `profession_id`.
- Migrations `0003_*` adds `categories.image`, the two enums, and the `professions`
  + `requirement_fields` tables.
- `profileStatus` / `hirerType` / `orgType` — pgEnums for onboarding profiles.
- `worker_profiles` — one per user (`user_id` unique FK → user, cascade): names,
  `photo_url`, city/state, `lat`/`lng` (double precision), `languages` jsonb,
  `answers` jsonb (`Record<key, string|string[]>`), `status` (`profile_status`,
  default `draft`), `current_step`, `submitted_at`, the verification columns
  `rejection_reason`, `reviewed_at`, `reviewed_by` (FK → user, `ON DELETE SET NULL`),
  plus the Phase-3 precise-location metadata `location_accuracy` (metres) +
  `location_captured_at` (the high-accuracy capture overwrites `lat`/`lng`), the
  setup-flow markers `availability_reviewed_at` + `setup_completed_at` (migration
  `0007_*`), and timestamps.
- `worker_professions` — worker↔profession join (composite PK
  `(worker_profile_id, profession_id)`, both FKs cascade; index on profession).
- `worker_profession_rates` — what an approved worker charges per profession
  (composite PK `(worker_profile_id, profession_id)`, both FKs cascade): nullable
  `daily_rate`/`hourly_rate` (INR whole rupees), timestamps; index on profession.
- `worker_days_off` — days an approved worker is **not** working (`id`,
  `worker_profile_id` FK cascade, nullable `profession_id` FK cascade — null ⇒ all
  professions, `date` `YYYY-MM-DD`, `created_at`); index on `(worker_profile_id,
  date)`. Default (no row) = available.
- `worker_profiles.is_online` / `last_online_at` — Uber-style presence; only online
  workers receive job offers (migration `0008_*`).
- `jobStatus` / `offerStatus` — pgEnums. `jobs` — a hirer's search (`hirer_profile_id`
  + `profession_id` FKs cascade, `lat`/`lng`, `radius_km`, `status`,
  `matched_worker_profile_id` FK→worker set-null, `expires_at`; index on `status`).
  `job_offers` — one offer per (job, worker) (`job_id`/`worker_profile_id` FKs cascade,
  `status`, `responded_at`; unique `(job_id, worker_profile_id)`, index on
  `(worker_profile_id, status)`). Migration `0008_*`. Migration `0009_*` extends
  `jobStatus` with `in_progress`/`completed` and adds `jobs.start_otp`/`end_otp`/
  `started_at`/`completed_at`/`cancelled_by` (the OTP handshake lifecycle); migration
  `0010_*` adds `jobs.start_requested_at` (the worker's "Start work" gate).
- `rateUnit` pgEnum (`daily|hourly`) + **job pricing** on `jobs` (migration
  `0013_*`, additive with defaults so existing rows are safe): `rate_unit`
  (default `daily`), `quantity` (default 1), `worker_rate_rupees`, `amount_paise`.
  The hirer fixes the *shape* of the price at booking (`rate_unit` + `quantity`);
  the amount is only knowable once a worker accepts, since every worker sets their
  own rate. The last two columns are **snapshots written in the accept
  transaction** — a worker changing their rate later must never move the price of
  an already-agreed job. Null on jobs that never matched.
- `hirer_profiles` — one per user: names, `photo_url`, city/state/lat/lng,
  `hirer_type`, `org_name`, `org_type`, `gst_registered`, `gstin`, `status`,
  `current_step`, `submitted_at`, the same `rejection_reason`/`reviewed_at`/
  `reviewed_by` columns, timestamps.
- `push_tokens` — Expo push tokens per device (`user_id` FK cascade, `token` unique,
  `platform`, timestamps; index on user). Re-register re-points a token at the user.
- `notifications` — in-app notifications (`user_id` FK cascade, `type`, `title`,
  `body`, optional `data` jsonb, `read`, `created_at`; index on user).
- `ratingDirection` — pgEnum (`worker_to_hirer` | `hirer_to_worker`). `ratings`
  (§8) — one row per (job, direction): `job_id` FK cascade, `direction`,
  `stars` (1-5, validated in zod/route — no DB CHECK, matching the convention
  elsewhere), optional `comment`, `created_at`; unique `(job_id, direction)` +
  index on `job_id`. `worker_profiles`/`hirer_profiles` each carry a
  denormalized `avg_rating` (nullable) + `rating_count` (default 0), updated
  transactionally when a rating for them is submitted.
- `worker_profiles.avgRating`/`ratingCount` and `hirer_profiles.avgRating`/
  `ratingCount` — see `ratings` above.
- `chatSenderRole` — pgEnum (`worker` | `hirer`). `chatMessageType` — pgEnum
  (`text` | `location`). `chat_messages` (§7) — one row per message: `job_id`
  FK cascade, `sender_role` (resolved server-side from job ownership, never
  client-supplied), `type`, `body` (text messages), `lat`/`lng` (location
  messages), `created_at`; index on `(job_id, created_at)`. No sender
  user/profile id column — within one job there are exactly two parties.
- Migration `0004_*` adds the three enums + `worker_profiles` /
  `worker_professions` / `hirer_profiles` tables. Migration `0005_*` adds the
  verification columns + `push_tokens` / `notifications` tables. Migration `0006_*`
  adds the `professions` price-bound columns, `worker_profiles` location-metadata
  columns, and the `worker_profession_rates` / `worker_days_off` tables. Migration
  `0011_*` adds `ratingDirection` + `ratings` and the two profiles' rating
  aggregate columns. Migration `0012_*` adds `chatSenderRole`/`chatMessageType`
  + `chat_messages`.

## src/db/auth-schema.ts
- better-auth Drizzle tables: `user`, `session`, `account`, `verification`.
  Mirrors `@better-auth/cli generate` output. The `user` table also carries ODJ's
  additional columns: `user_type`, `admin_role`, `onboarding_completed` (migration
  `0001_*`) and the profile columns `first_name`, `last_name`, `phone` (migration
  `0002_*`) — all kept in sync with `auth/index.ts` `additionalFields`.

## src/lib/email.ts
- `sendOtpEmail({ email, otp, type })` — branded **HTML** OTP email (text
  fallback) via Resend.
- `sendAdminInviteEmail({ email, inviteUrl })` — branded admin invite/welcome
  email with a CTA to `WEB_ORIGIN/login?invited=<email>`.
- `sendProfileApprovedEmail({ email, name })` — verification-approved email.
- `sendProfileRejectedEmail({ email, name, reason })` — rejection email; the reason
  is HTML-escaped (`escapeHtml`) and shown verbatim with a fix-&-re-submit CTA.
- Internal `emailShell()` (shared header/footer markup) + `send()` (Resend call
  with the non-prod dev fallback: logs instead of throwing when Resend fails).

## scripts/ensure-db.mjs
- Connects to the `postgres` maintenance DB (from `DATABASE_URL`) and
  `CREATE DATABASE` the target if it doesn't exist. Used by `db:ensure`;
  `db:setup` = `db:ensure` + `db:migrate` (one-shot local DB bootstrap).

## scripts/seed-demo.ts
- `pnpm --filter @odj/backend db:seed-demo` — populates a **demo/staging** DB so
  the app has something to show. Without it every category list is blank and
  every search returns "no workers", which reads as broken rather than empty.
- Seeds 6 categories / 12 professions with admin price bounds (some deliberately
  single-unit — Truck Driver daily-only, Deep Cleaner hourly-only — to exercise
  the booking screen's unit handling), 7 approved **online** workers scattered
  2–12 km around Bengaluru (inside `DEFAULT_RADIUS_KM`) with rates inside bounds,
  and one approved hirer.
- **Idempotent** — keyed on category/profession slug and user email, so re-running
  tops up rather than duplicating.
- Two accounts use Gmail `+aliases` so both sides of the hiring flow can be signed
  into from one inbox; the rest use an unroutable `.invalid` domain and exist as
  searchable supply, not as accounts anyone logs into.
- Sets `avgRating`/`ratingCount` directly for display; there are no matching
  `ratings` rows, since a real rating requires a completed job. Ratings written
  through the app stay transactionally consistent.

## src/routes/health.ts
- `healthRouter` (mounted at `/api/health`):
  - `GET /` — **liveness**: 200 with `HealthResponse`; includes best-effort `db`
    summary; does not hard-depend on DB.
  - `GET /db` — **readiness**: runs `SELECT 1`; 200 `connected` / 503
    `disconnected` with `DbHealth` (latencyMs, error?).
- `checkDb()` — internal helper, returns `{ ok, latencyMs, error? }`.
