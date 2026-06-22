# ODJ — Design system (styling source of truth)

Cross-cutting visual language for **web** (Tailwind v4 + shadcn) and **mobile**
(NativeWind v3 + react-native-reusables). The two platforms express the *same*
tokens in different color syntaxes (web = `oklch`, mobile = `hsl` channels), so
**when you change a value, change it in both** files and keep them visually equal.

| Token surface | Web | Mobile |
| ------------- | --- | ------ |
| Color / radius vars | `apps/web/src/app/globals.css` | `apps/mobile/src/global.css` |
| Theme mapping | `@theme inline` in `globals.css` | `tailwind.config.js` |
| Primitives | `apps/web/src/components/ui/*` | `apps/mobile/src/components/ui/*` |

## 1. Brand font — Poppins

The brand typeface is **Poppins** on both platforms.

- **Web:** loaded via `next/font/google` in `app/layout.tsx` (weights
  **300, 400, 500, 600, 700**), exposed as the CSS var `--font-sans` →
  Tailwind's `font-sans` (applied to `<html>` in `globals.css`). Everything
  inherits it.
- **Mobile:** loaded via `useFonts` (`@expo-google-fonts/poppins`) in
  `app/_layout.tsx` (weights 400/500/600/700; a spinner blocks the UI until
  fonts are ready). React Native **cannot synthesise a weight from one font
  file**, so `tailwind.config.js` maps a distinct family per weight:

  | Use | Web class | Mobile class |
  | --- | --------- | ------------ |
  | Body (light) | `font-light` (300) — **the `<body>` default** | n/a (mobile body = 400) |
  | Body / UI | `font-normal` (400) | `font-sans` (the `Text` default) |
  | Emphasis | `font-medium` (500) | `font-poppins-medium` |
  | Buttons / labels | `font-medium`/`font-semibold` | `font-poppins-semibold` |
  | Headings | `font-semibold` (600) | `font-poppins-semibold` |

  > On mobile use `font-poppins-*` for weight — `font-bold`/`font-medium` only
  > set `fontWeight`, which won't switch the Poppins file. `ui/text.tsx` defaults
  > to `font-sans` so all `Text` is Poppins.

- **Headings are semibold (600), not bold** — bold reads too heavy for the brand.
- **Web body text is light (300)** — set once as the `<body>` default; headings,
  buttons, and labels opt into heavier weights.

## 2. Color — one primary (blue)

A single brand accent: **modern blue**. No secondary accent colors; everything
else is neutral. Interaction states are **shades of the same hue, never shadows**.

| Token | Light | Dark | Notes |
| ----- | ----- | ---- | ----- |
| `--primary` | `#2563EB`-ish (blue-600) | brighter blue-500 | base fill |
| `--primary-hover` | darker | lighter | web only (no hover on touch) |
| `--primary-active` | darker still | lighter still | press state |
| `--primary-foreground` | white | white | text on primary |
| `--ring`, `--sidebar-primary`, `--chart-1` | = primary | = primary | accents track primary |

- Web values are `oklch(...)` in `globals.css`; the hover/active shades are mapped
  to `--color-primary-hover` / `--color-primary-active` in `@theme inline`, so any
  component can use `bg-primary-hover` / `bg-primary-active` (not just buttons).
- Mobile values are `hsl` channels in `global.css` (`221 83% 53%` light /
  `217 91% 60%` dark).
- Dark mode **lightens** interaction shades (instead of darkening) so state stays
  visible against the dark background.
- **`--destructive`** = a strong, **readable** red (used as text/icon color for
  delete actions and form errors). Light mode ≈ red-600; dark mode is a *lighter*
  saturated red so it reads on the dark background (a dark red would be illegible).

## 3. Radius

`--radius: 0.75rem` on both platforms. Derived steps:

- **Buttons** = extra-round: web `rounded-xl`, mobile `rounded-xl`
  (`borderRadius.xl` in mobile `tailwind.config.js`).
- **Inputs** = slightly less round than buttons: `rounded-lg`.
- **Cards** = `rounded-2xl` (web).

## 4. Elevation

- **Buttons: no shadow.** Depth/feedback comes from the color shade change on
  hover/active (+ a 1px press nudge on web). This is deliberate — earlier coloured
  shadows read as an unwanted glow/outline.
- **Cards (web):** one soft elevation shadow
  (`0 1px 3px …, 0 12px 32px -12px …`) — the only place shadows are used.

## 5. Primitives (where to change reusable styles)

Change these, not call sites — everything inherits.

- **Web** `components/ui/button.tsx` — variants (`default` = solid primary +
  `hover:bg-primary-hover active:bg-primary-active`, plus `outline`/`secondary`/
  `ghost`/`destructive`/`link`) and sizes (`default` h-11, `sm` h-9, `lg` h-12,
  `icon*`). Base sets `cursor-pointer`, `rounded-xl`, focus ring.
- **Web** `components/ui/input.tsx` — `h-11 rounded-lg`. `card.tsx` — soft shadow.
  `input-otp.tsx` — shadcn segmented OTP field; `dropdown-menu.tsx` items are
  `cursor-pointer`.
- **Mobile** `components/ui/button.tsx` — `buttonVariants` + `buttonTextVariants`
  (text uses `font-poppins-semibold`); `rounded-xl`, no shadow, `active:opacity-90`.
- **Mobile** `components/ui/input.tsx` — `h-12 rounded-lg font-sans`.
  `components/ui/text.tsx` — `font-sans` default + `TextClassContext`.
  `components/ui/otp-input.tsx` — segmented OTP field (transparent overlay input).

## Checklist when restyling

1. Color/radius → edit the two token files **together** (web oklch + mobile hsl).
2. Component shape/size → edit the matching primitive, never the screen.
3. New font weight → web: add to the `Poppins({ weight: [...] })` array; mobile:
   add the weight to `useFonts` **and** a `font-poppins-*` family in tailwind config.
