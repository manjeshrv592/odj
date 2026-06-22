# @odj/mobile — architecture

**Path:** `apps/mobile` · **Role:** Expo (SDK 56) app for workers & hirers.
expo-router, NativeWind (Tailwind v3), react-native-reusables conventions,
TanStack Query, better-auth Expo client.

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
    │   ├── index.tsx      # home — "ODJ mobile app" + health + theme toggle
    │   └── (auth)/        # auth screens group
    │       ├── login.tsx    # Email/Phone choice (phone stubbed) → send OTP
    │       ├── otp.tsx      # enter OTP → signIn.emailOtp
    │       └── continue.tsx # "Continue as" Work/Hire (stub buttons)
    ├── components/
    │   ├── providers.tsx  # QueryClient + ThemeContext (NativeWind colorScheme)
    │   ├── theme-toggle.tsx # light/dark toggle (Pressable)
    │   ├── health-status.tsx # backend health card (TanStack Query)
    │   └── ui/            # rnr primitives: text, button, input, otp-input
    └── lib/
        ├── utils.ts       # cn()
        ├── api.ts         # API_URL + apiFetch()
        ├── storage.ts     # cross-platform storage (SecureStore native / localStorage web)
        └── auth-client.ts # better-auth expo client (+ inferAdditionalFields)
```

## src/app/_layout.tsx
- Imports `../global.css`. Loads the **Poppins** brand font via
  `useFonts` (`@expo-google-fonts/poppins`, weights 400/500/600/700) and shows a
  spinner until ready. Root `Stack` (headers hidden) wrapped in
  `GestureHandlerRootView` → `SafeAreaProvider` → `<Providers>` → `<SessionGate>`.
- `SessionGate` — watches `useSession()`; routes by state: unauthenticated →
  `(auth)/login`; authed + `!onboardingCompleted` → `(auth)/continue`; authed +
  done → `index`. Shows a spinner while the session restores.

## src/app/index.tsx
- `HomeScreen` — renders **"ODJ mobile app"**, `<HealthStatus>`, `<ThemeToggle>`.

## src/app/(auth)/
- `login.tsx` — Email/Phone choice (phone shows the not-available message);
  email → `emailOtp.sendVerificationOtp` then navigates to `otp` with the email.
- `otp.tsx` — enter the 6-digit code → `signIn.emailOtp`; SessionGate routes on.
- `continue.tsx` — "Continue as" Work/Hire **stub** buttons (Alert placeholder)
  + sign-out. Real role persistence is the next feature.

## src/components/ui/
- `text.tsx` — `Text` + `TextClassContext` (rnr text-style inheritance).
- `button.tsx` — `Button` (cva variants/sizes; styles descendant `Text`).
- `input.tsx` — `Input` (themed `TextInput`).
- `otp-input.tsx` — `OtpInput`: segmented one-time-code field (the mobile
  counterpart to shadcn `input-otp`); a transparent overlay `TextInput` drives
  boxes that highlight the active slot. Used by `(auth)/otp.tsx`.

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
