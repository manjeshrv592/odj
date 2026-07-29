# ODJ — Infrastructure Setup (Maps + Push Notifications)

> **Looking for payments?** Razorpay / RazorpayX account setup for §5 lives in
> [PAYMENTS_SETUP.md](./PAYMENTS_SETUP.md).

> **Why this exists.** The Uber-style hiring flow (hirer searches → nearby workers
> get a push → first to accept wins → hirer sees the worker on a live map) needs an
> **interactive map** and **push notifications**. Neither works in **Expo Go** — both
> require a native **development build** (EAS) plus a few cloud accounts. This is the
> **one-time setup you complete**. When you're done, fill in the **[Hand-back
> checklist](#hand-back-checklist)** at the bottom and we'll wire the app to it.
>
> You do **not** write any code here — this is accounts, keys, and one build.

---

## What each piece unlocks

| You set up | Unlocks | Needed for |
| --- | --- | --- |
| **EAS dev build** (leaves Expo Go) | Native modules (maps, push) run on your phone | Everything below |
| **Google Cloud + Maps** | The interactive map view | Hirer "searching…" + live worker position |
| **Firebase (FCM)** | Android push delivery | Workers notified of a job when app is backgrounded |
| **Apple Developer + APNs** | iOS builds + iOS push | Only if you want iOS (can skip for now) |

## Cost summary

| Service | Cost | Notes |
| --- | --- | --- |
| Expo / EAS | **Free** tier is fine | Free builds queue; that's OK for us |
| Google Cloud Maps | **Free within credit** | Needs a billing card on file; low usage stays free |
| Firebase (FCM) | **Free** | Spark plan covers push |
| Apple Developer | **$99 / year** | **iOS only** — skip until you want iPhone support |
| Google Play | $25 one-time | Only to *publish* to the Play Store — **not** needed for dev builds |

## Recommended order — **Android first**

Android needs **no paid account** to build and run a dev build on a real device, so
you can demo the full maps + push flow on Android for basically free. **Do Steps
1–5 for Android first.** Add iOS (Step 6) later only if you want it.

---

## Step 1 — Expo account + EAS CLI + project ID

- [ ] Create an account at **https://expo.dev** (free).
- [ ] Install the CLI and log in:
  ```bash
  npm install -g eas-cli
  eas login
  ```
- [ ] From the mobile app, initialize EAS (creates the project + writes a
      **projectId** into `apps/mobile/app.json` under `extra.eas.projectId`):
  ```bash
  cd apps/mobile
  eas init
  ```
- [ ] Generate build profiles (`eas.json`):
  ```bash
  eas build:configure
  ```

➡️ **Hand back:** the **EAS projectId** (or just confirm `eas init` ran — I can read
it from `app.json`).

---

## Step 2 — App identifiers

These are permanent once you publish to a store, so pick them deliberately (reverse
domain style). You do **not** need to own the domain.

- [ ] Decide an app identifier, e.g. **`com.odj.app`** (or `com.yourcompany.odj`).
- [ ] Add to `apps/mobile/app.json`:
  ```jsonc
  "ios":     { "bundleIdentifier": "com.odj.app" },
  "android": { "package": "com.odj.app" }
  ```
  (I can make this edit for you — just tell me the identifier you chose.)

➡️ **Hand back:** the **bundle identifier / package name** you chose.

---

## Step 3 — First Android development build

This produces an installable app (a "dev client") that **replaces Expo Go** and can
run maps + push.

- [ ] Add the dev-client package:
  ```bash
  cd apps/mobile
  npx expo install expo-dev-client
  ```
- [ ] Build for Android (EAS builds it in the cloud; let EAS **generate a keystore**
      when prompted):
  ```bash
  eas build --profile development --platform android
  ```
- [ ] When it finishes, install the `.apk` on your Android phone (scan the QR / open
      the link EAS gives you).
- [ ] From then on, start the dev server with `npx expo start --dev-client` and open
      the app from your **dev build**, not Expo Go.

➡️ **Hand back:** confirm the **dev build installs and opens** on your phone. Also
grab the Android signing **SHA-1** (you'll need it in Step 5) — run `eas credentials`
→ Android → view the keystore's SHA-1 fingerprint.

---

> **⚠️ You're on local builds (Appendix), not EAS.** So for the rest of the steps:
> - Wherever a step implies rebuilding, run **`npx expo run:android`** (from
>   `apps/mobile`) instead of `eas build …`. Adding `google-services.json` (Step 4)
>   and the Maps key (Step 5) are **native config changes**, so you must rebuild for
>   them to take effect.
> - The `eas credentials` / expo.dev **credential uploads still apply** (those are
>   project-level, independent of how you build) — the FCM key upload in Step 4 is
>   still required for Expo push to reach Android.
> - For the **Maps key SHA-1** (Step 5), use your **debug keystore** SHA-1, not an
>   EAS keystore: `cd apps/mobile/android && ./gradlew signingReport` → the `debug`
>   variant's `SHA1`. (Or create the key with **no app restriction** first to test,
>   then lock it down later.)

## Step 4 — Push notifications (Android via Firebase / FCM)

We use **Expo Push** (the backend already has the sending side built:
`push_tokens` table + `sendExpoPush` + `notifyUser`). Android delivery goes through
Firebase Cloud Messaging (FCM), so:

- [ ] Create a project at **https://console.firebase.google.com** (free).
- [ ] **Add an Android app** to it — use the **exact package name** from Step 2.
- [ ] Download the **`google-services.json`** it gives you → place it at
      `apps/mobile/google-services.json` and reference it in `app.json`
      (`"android": { "googleServicesFile": "./google-services.json" }`). *(I can do
      the app.json part.)*
- [ ] Give Expo permission to send to FCM: in Firebase **Project Settings → Service
      accounts → Generate new private key** (a JSON file), then upload it to Expo via
      `eas credentials` (Android → **FCM V1 service account key**) or the expo.dev
      dashboard → your project → Credentials.

➡️ **Hand back:** confirm **`google-services.json` is in place** and the **FCM key is
uploaded to Expo**. (I then re-add `expo-notifications`, register the device token,
and POST it to the existing `/api/app/push-tokens`.)

---

## Step 5 — Maps: MapLibre + OpenFreeMap (no Google, no billing)

We **dropped Google Maps** — the billing activation was a headache and we only need
to show **points (workers) on a map**, not live turn-by-turn tracking. Instead we use
**MapLibre** (free, open-source native map renderer) with **OpenFreeMap** tiles —
**no API key, no billing, no signup, no Google Cloud**.

- [x] `@maplibre/maplibre-react-native` added + its Expo config plugin wired into
      `app.json` (done in-app).
- [x] Basemap: OpenFreeMap style URL (`https://tiles.openfreemap.org/styles/liberty`)
      — key-less. (For production, swap to a paid/self-hosted tile source later; the
      app code barely changes.)
- [ ] **Rebuild** so the native MapLibre module is bundled (it's a native change):
      ```bash
      npx expo prebuild --clean
      npx expo run:android
      ```

➡️ **Nothing to hand back** — there's no key. Google Cloud is off the critical path
(chase their support whenever, or never).

---

## Step 6 — Apple Developer (iOS only — optional, do later)

Skip this entirely if you're demoing on Android first.

- [ ] Enroll in the **Apple Developer Program** (**$99/year**) at
      **https://developer.apple.com**.
- [ ] Let **EAS manage credentials** — during `eas build --platform ios` it can
      create the App ID, provisioning profile, and the **APNs key** for push if you
      grant it your Apple account, or you can create the **APNs key (.p8)** manually
      and upload it via `eas credentials`.
- [ ] Build + install the iOS dev build:
  ```bash
  eas build --profile development --platform ios
  ```

➡️ **Hand back:** confirm iOS dev build installs + APNs key uploaded to Expo.

---

## Hand-back checklist

When you've finished (Android is enough to start), reply with these and I'll wire up
the app + build the matching feature:

- [ ] **EAS projectId** — done via `eas init` (confirm, or I'll read it)
- [ ] **App identifier** (bundle id / package), e.g. `com.odj.app`
- [ ] **Android dev build** installs + opens on your phone ✅
- [ ] **google-services.json** in `apps/mobile/` + **FCM key uploaded to Expo** ✅
- [ ] **Google Maps Android API key** (+ iOS key if applicable)
- [ ] *(iOS only)* Apple Developer enrolled + **APNs key** uploaded, iOS dev build works

## What I'll build once this is ready

- **App:** re-add `expo-notifications` (register token → existing
  `/api/app/push-tokens`), add `react-native-maps` (Google) for the hirer search +
  live worker map, and the worker "go online" + incoming-offer screens.
- **Backend:** Haversine radius search over worker `lat/lng`, filtered by profession
  + rate + the day-off calendar; broadcast a job offer to matched workers via
  `notifyUser` (push) — the seam is already there; race-safe **first-accept-wins**
  with an offer timeout; hirer sees the accepted worker's name + live position.

## Appendix — Local Android builds (skip the EAS queue)

The EAS free-tier queue can take 30+ min. To build **locally on Windows** (no queue,
fast cached rebuilds), use `npx expo run:android` — **not** `eas build --local` (that
one is macOS/Linux/WSL only). One-time toolchain setup:

**1. JDK 17** (Android Gradle Plugin requires it)
- Install **Eclipse Temurin JDK 17** (https://adoptium.net).
- Set `JAVA_HOME` to its folder (e.g. `C:\Program Files\Eclipse Adoptium\jdk-17...`).

**2. Android SDK** (easiest via Android Studio)
- Install **Android Studio** → it brings the SDK, `platform-tools` (adb), and emulator.
- In **SDK Manager**, make sure these are installed: **Android SDK Platform 35/36**,
  **Build-Tools**, **Platform-Tools**, **NDK (Side by side)**, **CMake**.

**3. Environment variables** (System → Environment Variables)
- `ANDROID_HOME` = `C:\Users\<you>\AppData\Local\Android\Sdk`
- Add to `Path`: `%ANDROID_HOME%\platform-tools`
- Restart the terminal (and VS Code) so the vars load. Verify: `adb --version` works.

**4. Connect a device** — phone via USB with **USB debugging** on (or start an emulator
from Android Studio). Confirm with `adb devices` (your device should be listed).

**5. Build + install locally** — from `apps/mobile`:
```bash
npx expo run:android
```
- First run generates the native `android/` folder (`expo prebuild`) and downloads
  Gradle deps — **slow (~10–20 min)**. Later builds are cached and fast.
- It compiles the dev client and installs it on the connected device automatically,
  then Metro starts. No EAS queue involved.

**Notes:**
- This creates an `apps/mobile/android/` folder (gitignored by default; it's
  regenerated from `app.json`). After changing native config in `app.json` (new
  plugin, keys), re-run `npx expo run:android` (or `npx expo prebuild --clean`).
- Add a **Defender exclusion** for the repo to keep Gradle from crawling.
- Grab the debug **SHA-1** for the Maps key with:
  `cd android && ./gradlew signingReport` (look for the `debug` variant's SHA1).

## Notes & gotchas

- **Expo Go is done** for this feature — after Step 3 you run everything from the dev
  build (`npx expo start --dev-client`). Rebuild the dev client only when you add a
  new native module or change `app.json` native config.
- **Windows/pnpm:** installs on this machine sometimes fail on antivirus file locks —
  if `npx expo install …` errors with `EPERM`/`ENOENT`, add a Defender exclusion for
  the repo + `%LOCALAPPDATA%\pnpm` and retry (see our earlier fix).
- **Keys never get committed.** `.env` is git-ignored; only `app.json` references +
  `google-services.json` handling need care. I'll set the wiring so nothing secret is
  tracked.
- **Background location is *not* required** for this flow — workers just need their
  last captured location + to be "online". Background tracking (`expo-task-manager`)
  stays deferred.
