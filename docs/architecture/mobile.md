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
    │   ├── _layout.tsx    # root Stack — GestureHandler+SafeArea+<Providers>, imports global.css
    │   └── index.tsx      # home — "ODJ mobile app" + health + theme toggle
    ├── components/
    │   ├── providers.tsx  # QueryClient + ThemeContext (NativeWind colorScheme)
    │   ├── theme-toggle.tsx # light/dark toggle (Pressable)
    │   └── health-status.tsx # backend health card (TanStack Query)
    └── lib/
        ├── utils.ts       # cn()
        ├── api.ts         # API_URL + apiFetch()
        └── auth-client.ts # better-auth expo client (secure-store, scheme odj)
```

## src/app/_layout.tsx
- Imports `../global.css`. Root `Stack` (headers hidden) wrapped in
  `GestureHandlerRootView` → `SafeAreaProvider` → `<Providers>`; `StatusBar`.

## src/app/index.tsx
- `HomeScreen` — renders **"ODJ mobile app"**, `<HealthStatus>`, `<ThemeToggle>`.

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

## src/lib/auth-client.ts
- `authClient` — `createAuthClient` with `expoClient({ scheme: "odj",
  storagePrefix: "odj", storage: SecureStore })` + `emailOTPClient()`.
- Re-exports `signIn`, `signOut`, `useSession`.

## src/lib/utils.ts
- `cn(...)` — clsx + tailwind-merge.

## Styling / theming
- NativeWind `className` on RN core components (enabled via babel
  `jsxImportSource`). Tailwind tokens map to CSS variables in `global.css`
  (`bg-background`, `text-foreground`, …). Dark mode = `.dark` class toggled by
  NativeWind `colorScheme`.
