# ODJ — Payments Setup (Razorpay + RazorpayX)

> **Why this exists.** §5 Payments moves **real money**: the hirer pays ODJ, ODJ
> keeps a platform fee, and the worker gets the rest. That needs two *separate*
> Razorpay products, each with its own onboarding and its own API keys. This is the
> **one-time setup you complete** — accounts, KYC, and keys. You write no code.
>
> Companion to [INFRA_SETUP.md](./INFRA_SETUP.md) (maps + push). Same deal: work
> through the steps, then fill in the **[Hand-back checklist](#hand-back-checklist)**.
>
> **Everything I build runs in test mode.** I will not call a live endpoint, submit
> KYC, or move real money without asking you first, every time.

---

## ⚠️ Read this first — the one hard gate

**RazorpayX requires a business registered in India with a valid Indian PAN.**
A personal PAN alone won't do it. Accepted business types include sole
proprietorship, partnership, LLP and Pvt Ltd — a **sole proprietorship is the
lightest option** and is usually enough.

**If ODJ isn't registered yet, that's the first thing to sort out**, because it
blocks payouts (Step 3) entirely. It does *not* block collecting payments (Step 1)
or any of the development work — so tell me and we'll keep building against test
mode while you sort it.

---

## The two products (this is the confusing part)

They share the razorpay.com login but are **otherwise separate** — separate
onboarding, separate KYC, separate API keys, separate dashboards.

| | **Razorpay PG** | **RazorpayX** |
| --- | --- | --- |
| Does | Takes money **in** from hirers | Sends money **out** to workers |
| ODJ uses | Payment Links | Payouts API |
| Needs | Business KYC | Business KYC **+ a Current Account** |
| Keys | `RAZORPAY_KEY_ID` / `_SECRET` | `RAZORPAYX_KEY_ID` / `_SECRET` |

> **Why not Razorpay Route** (the one product that would do both in a single
> transaction)? It requires **>₹40L domestic turnover** in FY25/FY26 — an RBI
> Payment Aggregator rule from Sept 2025 that a pre-revenue marketplace can't meet.
> Re-checked live on 2026-07-29: still gated. Step 2 has you confirm it in your own
> dashboard anyway, in case your account differs.

## Cost summary

| Thing | Cost | Notes |
| --- | --- | --- |
| Razorpay PG account | **Free** to open | No monthly fee |
| Collecting via **UPI** | **0%** | Zero MDR is regulated in India — most collections cost nothing |
| Collecting via **card / netbanking** | **~2% + GST** | Confirm your exact rate on your dashboard's pricing page |
| RazorpayX account | **Free** — no setup fee, **no minimum balance**, no monthly maintenance | Verified 2026-07-29 |
| **Payout** (IMPS / UPI / NEFT) | **₹2–5 flat each** | Flat per payout, not a percentage — this is why we pay workers instantly per job rather than batching |
| Penny-drop account validation | Charged per validation | Reversed if the validation fails. Optional — see Step 6 |

**Worked example, ₹1,000 job at a 15% fee:** hirer pays ₹1,000 (₹0 fees if UPI) →
worker gets ₹850 → payout costs ODJ ~₹3 → ODJ nets ~₹147.

## Recommended order

**Do Step 1 first and hand back the test keys** — that alone unblocks all remaining
development. Steps 3–4 (KYC, current account) can run in parallel over days without
holding anything up, because nothing goes live until Step 7.

---

## Step 1 — Razorpay PG: account + **test** keys

- [ ] Sign up / log in at **https://dashboard.razorpay.com**.
- [ ] Flip the dashboard to **Test Mode** (toggle in the top bar).
- [ ] Go to **Account & Settings → API Keys → Generate Test Key**.
- [ ] Copy the **Key ID** (`rzp_test_…`) and **Key Secret** — the secret is shown
      **once only**, so save it immediately.
- [ ] Check **Payment Links** is available: **Payment Links** in the left nav. If
      it's not there, enable it under Account & Settings → Configuration, or ask
      Razorpay support to switch it on.

➡️ **Hand back:** `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` (test). **This is the
one item that unblocks me.**

---

## Step 2 — Re-check Route (2 minutes, probably a dead end)

Worth confirming with your own eyes rather than trusting my research.

- [ ] In the dashboard, search for **Route** (or check Account & Settings →
      Configuration).
- [ ] If it shows a turnover/eligibility gate → expected, nothing to do.
- [ ] If it's **actually available on your account** → tell me. It would simplify
      the whole design (one transaction instead of collect-then-pay-out, and
      Razorpay handles per-worker KYC for us).

➡️ **Hand back:** "Route is gated" *or* "Route is available".

---

## Step 3 — RazorpayX: signup + Current Account

- [ ] Go to **https://razorpay.com/x/** and start onboarding with the same login.
- [ ] Choose **Current Account** — note that **RazorpayX Lite is no longer offered
      to new merchants**, so the current account is the only route.
- [ ] Pick the partner bank it offers (ICICI / Axis / RBL / YES — take whichever is
      fastest to approve; it makes no difference to our code).
- [ ] Grab the **test** API keys from the **RazorpayX dashboard** in Test Mode.
      ⚠️ These are **not** the same keys as Step 1 — get them from the X dashboard.
- [ ] Note the **test account number** shown on the RazorpayX dashboard. Every
      payout API call has to specify which account it debits.

➡️ **Hand back:** `RAZORPAYX_KEY_ID`, `RAZORPAYX_KEY_SECRET`,
`RAZORPAYX_ACCOUNT_NUMBER` (all test).

---

## Step 4 — Business KYC (needed only to go live, not to build)

**Payouts work in test mode before KYC is approved** — so this is not blocking.

- [ ] Submit business KYC in the RazorpayX dashboard. Typically: business PAN,
      incorporation/registration proof, address proof, bank proof, and director/
      proprietor ID.
- [ ] **Ask about CKYC fast-track.** Since 2026-01-01 Razorpay can pull an existing
      Central KYC record (from a bank, mutual fund or insurance policy) and activate
      in minutes, skipping video KYC and manual uploads. Worth asking for — it's the
      difference between minutes and days.
- [ ] Remember PG and X are **separate KYC flows**. Completing one does not complete
      the other.

➡️ **Hand back:** KYC status for **both** products (submitted / approved).

---

## Step 5 — Webhooks

Webhooks are how the backend learns a payment succeeded or a payout landed. The
redirect back into the app is **not** trusted for this — only the webhook is.

Both webhooks need a **publicly reachable URL**. For local development, run a
tunnel to `localhost:4000`:

```bash
cloudflared tunnel --url http://localhost:4000    # free, no signup
```

That prints a `https://<random>.trycloudflare.com` URL — use it below. The URL
changes each restart, so expect to update the webhook when you restart the tunnel.

- [ ] **PG webhook** — Razorpay dashboard → **Settings → Webhooks → Add New**
  - URL: `https://<your-tunnel>/api/payments/webhook`
  - Events: `payment_link.paid`, `payment.captured`, `payment.failed`
  - Set a **secret** (invent a long random string) and save it.
- [ ] **RazorpayX webhook** — RazorpayX dashboard → **Settings → Webhooks**
  - URL: `https://<your-tunnel>/api/payments/payout-webhook`
  - Events: `payout.processed`, `payout.failed`, `payout.reversed`
  - Set a **secret** (a different one) and save it.

➡️ **Hand back:** `RAZORPAY_WEBHOOK_SECRET` + `RAZORPAYX_WEBHOOK_SECRET`.

> There's a safety net either way: the backend can re-fetch payment/payout status
> from Razorpay on demand, so a missed webhook self-heals. But webhooks are the
> primary path and worth setting up properly.

---

## Step 6 — Fund Account Validation (penny-drop) — *defer this*

Verifying a worker's bank account before paying it is nice to have, but the
Account Validation APIs **require IP allowlisting**, which needs a fixed egress IP
— you don't have one on a laptop. So we ship without it, behind a flag, and turn
it on once ODJ is deployed to a server with a static IP.

- [ ] Nothing to do now. Revisit at deployment.

---

## Step 7 — Going live 🚨 (do **not** do this yet)

Listed so you know what's coming. Every item here is irreversible or moves real
money, and I'll confirm with you before touching any of it.

- [ ] Both KYCs approved
- [ ] Generate **live** API keys for PG and X (separate from test keys)
- [ ] Re-point both webhooks at the real deployed domain, with fresh secrets
- [ ] **Fund the RazorpayX account** — payouts debit this balance. With
      `queue_if_low_balance` a short balance queues the payout rather than failing
      it, but a worker waiting on a queued payout is still a bad experience
- [ ] Confirm the platform fee % with real numbers (currently config, default 15%)
- [ ] Tax settings signed off — see below
- [ ] End-to-end test with a **real ₹1 job** before opening it to users

---

## Compliance — please talk to a CA

**I am not qualified to give tax advice, and I haven't encoded any.** ODJ acting as
a marketplace makes it an **e-commerce operator**, which carries obligations:

| | Current rate | Notes |
| --- | --- | --- |
| **TDS u/s 194-O** | **0.1%** | Cut from 1% in Budget 2024, effective 2024-10-01. Applies once a participant crosses **₹5L gross in a financial year** |
| **GST TCS u/s 52** | **0.5%** | 0.25% CGST + 0.25% SGST, or 0.5% IGST inter-state |

The code stores both as **configurable basis points, defaulting to 0**, precisely so
a professional sets the real values rather than me guessing. Questions worth asking
your CA:

1. Does ODJ need **GST registration as an e-commerce operator** before going live?
2. Do the ₹5L/FY per-worker thresholds apply, and who tracks them?
3. Should TDS/TCS be withheld from the worker's payout, or paid by ODJ separately?
4. What worker documentation (PAN) must be collected before paying them?

➡️ **Hand back:** the `platformFeeBps`, `tdsBps` and `tcsBps` values to configure —
or "leave at 0 for now" if you're testing before registering.

---

## Hand-back checklist

Reply with these and I'll wire everything up. **Step 1 alone unblocks me** — the
rest can follow.

- [ ] `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` (test) ← **unblocks all dev work**
- [ ] Payment Links enabled on the PG account ✅
- [ ] Route status: gated / available
- [ ] `RAZORPAYX_KEY_ID` + `RAZORPAYX_KEY_SECRET` + `RAZORPAYX_ACCOUNT_NUMBER` (test)
- [ ] `RAZORPAY_WEBHOOK_SECRET` + `RAZORPAYX_WEBHOOK_SECRET`
- [ ] Business registration status (blocks RazorpayX only)
- [ ] KYC status for PG and X
- [ ] Platform fee % + tax rates (or "0 for now")

**Send secrets however you normally would — they go in the git-ignored root `.env`,
never into a tracked file.** I'll add the matching entries to `.env.example` with
placeholder values when I build the collection phase.

---

## What I'll build once Step 1 lands

- **Worker payout details** — a screen for the worker to add a UPI ID or bank
  account, stored as a RazorpayX Contact + Fund Account.
- **Collection** — on end-of-job OTP the job becomes payable; the hirer taps "Pay
  ₹X", which opens a Razorpay Payment Link in an in-app browser (no new mobile
  dependency — `expo-web-browser` is already installed) and deep-links back. The
  webhook is what actually marks it paid.
- **Disbursement** — on confirmed payment, split the amount and fire an instant
  IMPS/UPI payout to the worker, with a stable idempotency key so a retry can never
  double-pay.
- **Receipts + admin** — itemised receipts on mobile, and an admin Payments section
  to see failures, retry payouts, and edit the fee config.

## Notes & gotchas

- **Test mode is fully isolated.** Test contacts, fund accounts and payouts never
  appear in the live dashboard, and no real money moves. Razorpay publishes test
  card numbers and test UPI IDs for simulating success and failure.
- **Two dashboards, two sets of keys.** The single most common mistake here is
  using PG keys for a payout call. If something 401s, check which dashboard the key
  came from.
- **The key secret is shown once.** Save it when you generate it.
- **Never commit keys.** `.env` is git-ignored; only `.env.example` is tracked, with
  placeholders.
- **Rotate the test keys before going live** if they've been pasted around chat.
