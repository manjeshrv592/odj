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
- [x] Project docs: CLAUDE.md, ARCHITECTURE + per-package, FEATURES
- [~] Database `odj` created + migrations applied + health verified (needs DB credentials)

## 1. Authentication & onboarding

- [ ] Email OTP login UI — web
- [ ] Email OTP login UI — mobile
- [ ] SMS OTP login (future — needs DLT setup)
- [ ] Role selection at signup (worker / hirer)
- [ ] Worker profile creation
- [ ] Hirer profile creation
- [ ] Session management / protected routes (web + mobile)

## 2. Admin — platform configuration

- [ ] Manage working domains/categories (Driver, Bouncer, Maid, …)
- [ ] Define required documents per domain
- [ ] Admin dashboard shell + auth (admin role)
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
