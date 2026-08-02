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

### Versioning — bump it on EVERY build that leaves this machine

**Rule: never hand out two different APKs carrying the same version.** This bit
us once already: the pre-HTTPS build and the HTTPS build were byte-for-byte
different but both reported `versionName 1.0.0 / versionCode 1`, so neither the
phone, the tester, nor the person distributing it could tell which was which —
and the older one could not log in at all.

Edit `apps/mobile/app.json` before rebuilding:

```jsonc
{
  "expo": {
    "version": "1.1.0",              // versionName — human-facing
    "android": { "versionCode": 2 }  // integer, MUST increase, never reused
  }
}
```

- **`version`** — semver. Bump patch for a rebuild that only changes config (a
  new API URL), minor for shipped feature work, major for a milestone.
- **`versionCode`** — a plain counter, `+1` on every distributed build. Android
  uses it for upgrade logic and Play Store rejects a re-used or lower value.
  Getting this right now avoids pain later; it is not something you can
  retroactively fix once builds are in people's hands.
- These live in `app.json`, which `expo prebuild` writes into
  `android/app/build.gradle`, so **a version bump requires a prebuild**, not just
  an `assembleRelease`:
  ```bash
  npx expo prebuild --clean -p android && cd android && \
    ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
  ```
- **Name the file with its version** when copying it out —
  `ODJ-demo-v1.1.0.apk` — so it is identifiable without `aapt`.
- Verify what you're about to send:
  ```bash
  aapt dump badging <file>.apk | grep "^package:"      # versionCode/versionName
  sha256sum <file>.apk                                  # distinguishes rebuilds
  ```

**Current state:** the distributed APK is `1.0.0 / versionCode 1`. The next
rebuild should start the convention at **`1.1.0` / `versionCode 2`.**

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

## Hardening plan

Not done — the box is a demo shortcut. These are ordered by *risk now*, not
effort. Items 1–3 matter if this server outlives the demo.

### 1. Rotate the root password + lock down SSH — **do first, ~5 min**

The root password was transmitted in plaintext during setup and is visible to
anyone with Vultr account access. Key auth is already in place
(`/root/.ssh/authorized_keys`), so rotating breaks nothing.

```bash
# Vultr panel → Server → Settings → Change root password, OR:
ssh root@139.84.222.70 passwd

# then, once key auth is confirmed working from a SECOND terminal:
#   /etc/ssh/sshd_config  →  PasswordAuthentication no
#   systemctl restart ssh
```

⚠️ Verify key login in a second session **before** disabling password auth, or a
mistake locks you out (recoverable only via Vultr's web console).

### 2. Run the services as a non-root user — ~30 min

Both units currently run as root, so any RCE in the app is immediate root. Ports
3000/4000 are above 1024, so no privilege is needed to bind them.

```bash
adduser --system --group --home /srv/odj --shell /usr/sbin/nologin odj
chown -R odj:odj /srv/odj
chmod 600 /srv/odj/.env && chown odj:odj /srv/odj/.env
# add to BOTH unit files, under [Service]:
#   User=odj
#   Group=odj
systemctl daemon-reload && systemctl restart odj-backend odj-web
```

Watch for: pnpm's store and `node_modules` must be owned by `odj` (re-run
`pnpm install` as that user if in doubt), and `.next/` must be writable. The
Postgres role is already separate, so the DB needs no change. Consider adding
`NoNewPrivileges=true` and `ProtectSystem=strict` while editing the units.

### 3. Email capacity — a decision, not a task

**Resend's free tier is ~100 emails/day and login is email-OTP only, so every
single sign-in burns one.** Hitting the cap means *nobody can log in*, and it
will look like the app is broken rather than rate-limited.

Rough budget: one stakeholder testing both roles and re-logging a few times can
easily use 5–10. Twenty people through a demo day is plausible at the cap.

Options, cheapest first:
- **Brief stakeholders to log in once** and stay signed in — sessions persist, so
  repeat logins are usually avoidable.
- **Lengthen the session TTL** in better-auth so tokens outlive the demo.
- **Upgrade Resend** (paid tier ≈ $20/mo for ~50k emails) if the demo is wide.
- Watch the Resend dashboard during the demo; the cap arrives without warning.

Longer term this argues for SMS OTP (already on the roadmap, blocked on DLT
registration) since phone-based login is what workers will actually expect.

### Lower priority

- [ ] Drop `usesCleartextTraffic` from `app.json` now everything is HTTPS
      (needs a full `expo prebuild`, so bundle it with the next version bump).
- [ ] APK is **debug-signed** — fine for sideloading, triggers Play Protect
      warnings, unusable for Play Store. A real keystore must be created and then
      **kept forever**; losing it means the app can never be updated.
- [ ] No logical backups of the `odj` database — Vultr auto-backups cover the
      whole disk, but a nightly `pg_dump` to object storage would be better.
- [ ] No monitoring/alerting: if a service dies, systemd restarts it, but nothing
      tells you it happened.
- [ ] `sslip.io` is a third-party DNS service. Fine for a demo; a real domain is
      the right move before anything production-facing.
