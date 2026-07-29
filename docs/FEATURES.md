# ODJ — Features

Living checklist of platform features. Tick items as they are completed and add
sub-items as scope is refined. `[x]` done · `[~]` in progress · `[ ]` not started.

## 0. Foundation (this milestone)

- [x] pnpm + Turborepo monorepo skeleton
- [x] `@odj/shared` zod package (env, health, domain schemas)
- [x] Backend: Express 5 app + Drizzle/PostgreSQL wiring
- [x] Backend: better-auth server configured (email OTP via Resend, Drizzle adapter, Expo plugin)
- [x] Backend: health endpoints — `/api/health` (liveness) + `/api/health/db` (readiness)
- [x] Web: Next.js + Tailwind v4 + shadcn + next-themes + TanStack Query; shows "ODJ web app"
- [x] Mobile: Expo + expo-router + NativeWind + TanStack Query; shows "ODJ mobile app"
- [x] Dark/light theme on web (next-themes) and mobile (NativeWind + Context)
- [x] Design system: Poppins brand font + single blue primary, shared tokens &
      reusable primitives across web + mobile ([styling.md](./architecture/styling.md))
- [x] Project docs: CLAUDE.md, ARCHITECTURE + per-package, FEATURES
- [x] Database `odj` created + migrations applied + health verified (`/api/health/db` → connected)
- [x] Email: Resend domain `sigtest.website` verified; real test send confirmed (sender `no-reply@sigtest.website`)

## 1. Authentication & onboarding

- [x] Email OTP login UI — web (admin portal; invite-only)
- [x] Email OTP login UI — mobile (worker/hirer; phone stubbed)
- [ ] SMS OTP login (future — needs DLT setup)
- [x] Role selection at signup (worker / hirer) — mobile "Continue as" persists
      `userType` + creates the draft profile, then enters the role's wizard
- [x] Worker profile creation — mobile step-by-step wizard (name, photo, city/state,
      skills→professions, languages, cascaded requirement fields), per-step server save
      with resume; submit → `under_review` ("under verification" screen)
- [x] Hirer profile creation — mobile wizard (name, photo, city/state, individual vs
      business + org type/GSTIN), per-step save with resume; submit → `under_review`
- [x] Session management / protected routes (web `proxy.ts` + RSC guard; mobile
      `SessionGate`); admin API guarded by `requireAdmin`

## 2. Admin — platform configuration

- [x] Manage working domains/categories (Driver, Bouncer, Maid, …) — Catalog →
      Categories (with icon) → Professions, full CRUD + reorder (admin web)
- [x] Define required documents per domain — admin-authored requirement fields
      (text / file-upload / dropdown) at catalog/category/profession levels that
      **cascade** onto a profession's effective set; file fields pick allowed types
      (pdf/jpg/jpeg/png). Authoring side only; mobile worker flow reads it later.
- [x] Admin dashboard shell + auth (admin role) — sidebar shell, root seed,
      Portal-users CRUD (invite/rename/delete admins by email)
- [x] Admin profile completion (onboarding) — gated 3-step wizard (name, phone,
      optional Uploadcare avatar) before the dashboard; flips `onboardingCompleted`
- [x] Admin profile page — edit name/phone/avatar (no OTP) + OTP-verified email
      change (code sent to the new address)
- [ ] Dashboard analytics with shadcn charts

## 3. Admin — approvals

- [x] Review & approve/reject worker profiles + documents — admin Verifications
      queue (filter by type + status, default pending) → full detail (photo, skills,
      languages, label-resolved requirement answers + doc lightbox) → approve / reject
      with reason
- [x] Review & approve/reject hirer profiles — same queue/detail (individual vs
      business + org/GST shown)
- [x] Notifications to applicants on decision — branded email + in-app notification
      on approve/reject; rejected users see the reason and can fix & re-submit
      (→ `under_review`). Mobile push is deferred (needs an EAS dev build; backend seam
      ready) — see [ARCHITECTURE.md](./ARCHITECTURE.md).

## 4. Hiring flow

### Worker pricing, availability & location (matching prerequisites)

- [x] Admin price bounds per profession — daily + hourly ₹ min/max on the
      profession detail page (both-or-neither per unit, `min ≤ max`); constrains worker
      rates. (Phase 1)
- [x] Worker rates — approved worker sets a daily/hourly ₹ rate per profession,
      validated client + server against the admin bounds (only admin-enabled units
      shown). (Phase 1)
- [x] Worker availability calendar — mark days off for all professions or a
      specific profession (one-off dates; default = available). (Phase 2)
- [x] Worker precise location — one-time high-accuracy foreground capture
      (lat/lng + accuracy + capturedAt). (Phase 3)
- [x] "Go online" presence toggle — worker flips available-now (`is_online`); only
      online workers receive offers. (Live/background _movement_ tracking is out of scope
      — we plot points, not real-time position; would need `expo-task-manager`.)

### Hirer → worker matching

- [x] Search workers by category / profession — hirer browses Categories →
      Professions → starts a search (mobile `(hirer)` flow).
- [x] Hire a worker (Uber-style) — hirer picks a profession → MapLibre "searching…"
      map; backend Haversine radius (15 km) search over **online** workers respecting the
      day-off calendar; push `job_offer` to each; **race-safe first-accept-wins**; hirer
      sees the matched worker's name + pin. Worker "Go online" toggle + incoming-offer
      Accept/Decline. Real-time = push + ~2s polling.
- [x] Worker profile view (with ratings) — hirer taps into a matched worker's
      profile (name, city, professions, rating) from the search/status screen; a
      symmetric hirer profile view exists for the worker.
- [x] Start-of-job OTP verification — post-match active-job flow: hirer shows a
      4-digit code, worker enters it → job `in_progress` (`started_at`, notify hirer).
- [x] End-of-job OTP verification — hirer shows the completion code, worker enters
      it → `completed`. Either party can cancel a matched/in-progress job.
- [x] Job history + app nav — bottom **tab bar** per role (Home / Jobs / Profile);
      the **Jobs** tab lists Active / Completed / Cancelled. Worker accept → "on the way"
      → **Start work** gate before the start OTP. Job events are push-only (the in-app
      notifications list is reserved for account notices).

## 5. Payments — **up next** (decided 2026-07-29)

- [ ] Collect payment from hirer
- [ ] Platform fee calculation
- [ ] Disburse payout to worker
- [ ] Payment history / receipts

> **Decided approach: manual settlement + RazorpayX Payouts.** Razorpay
> **Route** (the original plan below) is blocked — it now requires proof of
> **>₹40L domestic turnover** (or >₹5L export) in FY25/FY26 before it's
> granted, an RBI Payment Aggregator rule effective September 2025 that a
> pre-revenue marketplace like ODJ doesn't meet, and test keys alone don't
> unblock it. Instead: the hirer pays the full amount via standard Razorpay
> Checkout into **ODJ's own Razorpay account** (no Route, no Linked
> Accounts); the platform fee is simply what's not forwarded; the worker's
> share is disbursed separately via the **RazorpayX Payouts API** — a
> distinct product with its own onboarding (a RazorpayX current account,
> business KYC, and — since RazorpayX doesn't do Route's automatic
> per-worker KYC — our own way of collecting + verifying each worker's
> bank/UPI payout details, e.g. Fund Account Validation/penny-drop). Needs
> live research at kickoff: current RazorpayX eligibility/onboarding,
> minimum balance rules, and the actual Payouts API shape, since this may
> have moved since last checked — and worth re-confirming Route's status
> directly in the Razorpay dashboard first, in case eligibility opened up.
>
> **Original intended approach (Razorpay Route — escrow marketplace model),
> superseded, kept for reference in case turnover ever clears the Route
> bar.** Hirer pays the full amount → held in Razorpay via a Route transfer
> with `on_hold: true` → released to the worker on job completion
> (end-of-job OTP). The platform fee is simply the amount not transferred
> (collect X, transfer Y, keep X−Y); factor in ~1% GST TCS + ~1% TDS (194-O)
> on payouts. Workers are onboarded as **Linked Accounts** — collect PAN +
> bank/IFSC in-app, **Razorpay does the KYC verification** (penny-drop, PAN,
> AML). Settlement to the worker is ~T+2/T+3 business days after release
> (Instant Settlement is a paid add-on).

## 6. Disputes

- [ ] Raise a dispute
- [ ] Dispute resolution workflow (admin)

## 7. Chat

- [x] Worker ↔ hirer chat — real-time, text + one-off location sharing (no
      files/images), live over WebSocket (`/ws/chat`) only while a job is
      `matched`/`in_progress`; read-only history stays visible after
      `completed`/`cancelled`. Online/typing presence shown in the chat
      header; new-message push while backgrounded (skipped if the recipient
      already has that job's chat open).
- [ ] Dispute / support chat
- [ ] AI moderation — block sharing of personal contact details, keep comms on-platform

## 8. Ratings

- [x] Rate workers after a job — hirer rates the matched worker (1-5 stars +
      optional comment), one-shot, only once the job is `completed`.
- [x] Rate hirers — symmetric worker→hirer rating, same rules.
- [x] Aggregate ratings on profiles — denormalized avg + count on
      `worker_profiles`/`hirer_profiles`, updated transactionally on submit; shown
      on each user's own Profile tab and on the counterpart's profile-view screen.
      Prompted both via an auto-navigate rate screen right after completion (push
      deep-link for the hirer, direct navigation for the worker) and a persistent
      "Rate →" entry on completed Jobs-tab rows. Admin visibility deferred.

> Many more features will be added as the product evolves. The user drives
> feature work step by step.
