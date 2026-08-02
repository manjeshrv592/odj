# ODJ — Deployment (demo VPS)

> The live stakeholder-demo deployment. Everything here was applied by hand on a
> fresh Vultr box; this file is the record so it can be rebuilt or handed over.
>
> Related: [INFRA_SETUP.md](./INFRA_SETUP.md) (mobile toolchain) ·
> [PAYMENTS_SETUP.md](./PAYMENTS_SETUP.md) (Razorpay accounts) ·
> [DEVELOPMENT.md](./DEVELOPMENT.md) (local dev)

## Live URLs

| | |
| --- | --- |
| **Admin portal / API** | **https://139-84-222-70.sslip.io** |
| Bare IP | `http://139.84.222.70` → 301 to the HTTPS host |
| Health | `/api/health` (liveness) · `/api/health/db` (readiness) |
| Shareable APK | built locally, points at the HTTPS host (see [Rebuilding the APK](#rebuilding-the-apk)) |

Admin login is the `ROOT_USER_EMAIL` from `.env`, seeded at backend startup.

## The box

Vultr · Bangalore · Ubuntu 26.04 LTS · 2 vCPU · 3.4 GB RAM (+4.8 GB swap) · 50 GB NVMe

All from Ubuntu's own repos — no third-party apt sources:

| | |
| --- | --- |
| Node | 22.22.1 (`nodejs` package; satisfies the repo's `>=22` engine) |
| pnpm | 11.5.2 — **installed via `npm i -g pnpm@11.5.2`, matching `packageManager`** |
| PostgreSQL | 18.4 |
| nginx | 1.28.3 |
| certbot | 4.0.0 (`python3-certbot-nginx`) |

> **Do not use Ubuntu's `corepack`** to provide pnpm. The Debian-patched build is
> broken on Node 22 (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`). Remove the
> `/usr/bin/pnpm` corepack symlink and install pnpm from npm instead.

## Layout

```
/srv/odj/                     # git clone of main, deployed tree
/srv/odj/.env                 # production env, chmod 600, NOT in git
/etc/systemd/system/odj-backend.service
/etc/systemd/system/odj-web.service
/etc/nginx/sites-available/odj
/etc/letsencrypt/live/139-84-222-70.sslip.io/
```

**Both services currently run as root** — a demo shortcut, not production
practice. Moving them to a dedicated `odj` user is the first hardening step.

## Request routing

One origin for everything. This is deliberate: it avoids CORS entirely, keeps the
better-auth session cookie host-scoped (see the note in `apps/web/src/proxy.ts`),
and lets the chat WebSocket work without extra configuration.

```
:443  ┌── /          → 127.0.0.1:3000   Next.js admin (odj-web)
      ├── /api/      → 127.0.0.1:4000   Express API (odj-backend)
      └── /ws/       → 127.0.0.1:4000   chat WebSocket, upgrade headers + 3600s timeout
:80   └── everything → 301 https://139-84-222-70.sslip.io$request_uri
```

Two details worth preserving:

- `proxy_pass` for `/api/` has **no trailing slash**, so the `/api` prefix is
  passed through rather than stripped.
- certbot's generated catch-all `default_server` block originally did
  `return 404`, which made the **bare IP 404** once `server_name` was set to the
  sslip.io host. It was changed to a 301 so old links and older APK builds keep
  working. Re-check this after any `certbot` run that rewrites the config.

## TLS

No domain was purchased. **`sslip.io`** is a public DNS service that resolves
`139-84-222-70.sslip.io` to `139.84.222.70`, which is enough for Let's Encrypt to
issue a normal certificate:

```bash
certbot --nginx -d 139-84-222-70.sslip.io --non-interactive --agree-tos \
        -m <admin-email> --redirect
```

Auto-renewal is handled by `certbot.timer` (enabled). Renewal rewrites the nginx
config, so re-check the catch-all redirect noted above afterwards.

**Why this matters beyond the padlock:** Chrome on Android enforces HTTPS-First,
so the plain-HTTP site simply would not open on a phone. More seriously, the
`301` redirect that plain HTTP required **downgrades POST to GET and drops the
body**, which silently broke email-OTP login from the mobile app (it showed up as
`GET /api/auth/email-otp/send-verification-otp → 404`). HTTPS end-to-end is a
correctness requirement here, not a nicety.

## Environment

`/srv/odj/.env` (chmod 600, never committed). Generated on the box:
`BETTER_AUTH_SECRET`, the Postgres role password. Carried over from local dev:
`RESEND_API_KEY` (**login is email-OTP only — without this nobody can sign in**),
`EMAIL_FROM`, the Uploadcare public key, `ROOT_USER_EMAIL`.

```ini
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://odj:<generated>@localhost:5432/odj
BETTER_AUTH_SECRET=<generated>
BETTER_AUTH_URL=https://139-84-222-70.sslip.io
WEB_ORIGIN=https://139-84-222-70.sslip.io
NEXT_PUBLIC_API_URL=https://139-84-222-70.sslip.io
MOBILE_SCHEME=odj
RESEND_API_KEY=…
EMAIL_FROM=…
NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY=…
ROOT_USER_EMAIL=…
```

`NEXT_PUBLIC_*` are **inlined at build time**, and Next.js loads `.env` from
`apps/web`, *not* the monorepo root — so they must be passed explicitly to the
build command (see below). `odj-web.service` also carries `NEXT_PUBLIC_API_URL`
for the runtime.

## Deploying a change

```bash
ssh root@139.84.222.70
cd /srv/odj
git fetch origin && git reset --hard origin/main
pnpm install --frozen-lockfile

pnpm db:migrate                                   # if migrations changed

NEXT_PUBLIC_API_URL=https://139-84-222-70.sslip.io \
NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY=$(grep -m1 '^NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY=' .env | cut -d= -f2-) \
pnpm --filter @odj/web build                      # if web changed

systemctl restart odj-backend odj-web
systemctl is-active odj-backend odj-web nginx
```

Logs: `journalctl -u odj-backend -f` · `journalctl -u odj-web -f` ·
`/var/log/nginx/access.log`.

## Demo data

```bash
pnpm --filter @odj/backend db:seed-demo
```

Idempotent. Seeds 6 categories / 12 professions with price bounds, 7 approved
**online** workers 2–12 km from Bengaluru centre (inside the 15 km match radius)
with rates set, and one approved hirer. Two accounts use Gmail `+aliases` so both
sides of the hiring flow can be signed into from a single inbox; the rest use an
unroutable `.invalid` domain and exist only as searchable supply.

## Rebuilding the APK

`EXPO_PUBLIC_API_URL` is compiled into the JS bundle, so the APK is tied to
whatever URL it was built against. `apps/mobile/.env` is gitignored, so **this
value is not recorded in the repo** — set it before building:

```bash
# apps/mobile/.env
EXPO_PUBLIC_API_URL=https://139-84-222-70.sslip.io

cd apps/mobile
rm -rf android/app/build/generated/assets        # .env is not a Gradle input;
                                                 # force Metro to re-bundle
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Output: `android/app/build/outputs/apk/release/app-release.apk` (~46 MB).

Always confirm the URL actually landed, then install and launch it before
distributing — a successful Gradle build proves nothing about runtime:

```bash
unzip -p app-release.apk assets/index.android.bundle | grep -c 139-84-222-70
adb install -r app-release.apk && adb shell am start -n com.sarvam.odj/.MainActivity
adb logcat -d | grep -E "FATAL|JavascriptException|Cannot find native module"
```

## Firewall

`ufw` active: **22** and **80/443** only. Ports 3000 and 4000 are not exposed —
they're reachable only through nginx.

## Known gaps / hardening backlog

- [ ] **Rotate the Vultr root password** (it was shared in plaintext during setup).
- [ ] Run `odj-backend` / `odj-web` as a non-root user.
- [ ] Disable SSH password auth once key access is confirmed (`/root/.ssh/authorized_keys`).
- [ ] Drop `usesCleartextTraffic` from `app.json` now that everything is HTTPS
      (needs a full `expo prebuild`, so it isn't free).
- [ ] APK is **debug-signed** — fine for sideloading, triggers Play Protect
      warnings, unusable for Play Store. Needs a real keystore, kept forever.
- [ ] No backups of the `odj` database (Vultr auto-backups cover the whole disk).
- [ ] `versionCode` is still `1`; bump it for clean in-place APK updates.
- [ ] Resend free tier is ~100 emails/day and **every login consumes one**.
