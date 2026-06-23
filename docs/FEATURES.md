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

- [ ] Review & approve/reject worker profiles + documents
- [ ] Review & approve/reject hirer profiles
- [ ] Notifications to applicants on decision

## 4. Hiring flow

- [ ] Search workers by category / filters
- [ ] Worker profile view (with ratings)
- [ ] Hire a worker
- [ ] Start-of-job OTP verification
- [ ] End-of-job OTP verification

## 5. Payments

- [ ] Collect payment from hirer
- [ ] Platform fee calculation
- [ ] Disburse payout to worker
- [ ] Payment history / receipts

## 6. Disputes

- [ ] Raise a dispute
- [ ] Dispute resolution workflow (admin)

## 7. Chat

- [ ] Worker ↔ hirer chat
- [ ] Dispute / support chat
- [ ] AI moderation — block sharing of personal contact details, keep comms on-platform

## 8. Ratings

- [ ] Rate workers after a job
- [ ] Rate hirers
- [ ] Aggregate ratings on profiles

> Many more features will be added as the product evolves. The user drives
> feature work step by step.
