# ToGo mobile (Expo) — iOS & Android

A native React Native passenger app built with **Expo (SDK 57)**, **Expo Router**,
and **TypeScript**, living under `apps/mobile`. It reuses the web app's
platform-neutral types, validation, and business rules — it is **not** a WebView
wrapper. The web app, backend, migrations, and tests are untouched.

## Project structure

```
apps/mobile/
  app/                         # Expo Router (file-based routes)
    _layout.tsx                # providers + connected-mode auth gate + deep-link handling
    (tabs)/                    # bottom tabs: Home, Hubs, My Trips, Account
      _layout.tsx  index.tsx  hubs.tsx  trips.tsx  account.tsx
    book/[tripId].tsx          # booking review + reserve (sticky total-fare action)
    hub/[hubId].tsx            # hub details: instructions, facilities, departures
    trip/[bookingId].tsx       # boarding pass (QR) + journey stages, check-in, cancel
    notifications.tsx          # in-app inbox + unread state
    auth.tsx  reset.tsx        # connected-mode sign in/up + password recovery
  src/
    env.ts                     # EXPO_PUBLIC_* → demo vs connected mode
    theme.ts                   # deep-green / warm-white / lime tokens
    data/AdapterProvider.tsx   # picks demo or Supabase adapter
    auth/AuthProvider.tsx      # connected auth (email/password)
    auth/useAuthDeepLinks.ts   # native auth callback handling (see limitations)
    lib/supabase.ts            # Supabase client (SecureStore session storage)
    lib/secureSessionStore.ts  # chunked Keychain/Keystore session store
    lib/demoStorage.ts         # AsyncStorage-backed demo persistence
    lib/feedback.ts            # gentle haptics + reduce-motion hook
    components/                # native UI kit: BottomSheet, SchematicMap,
                               #   DepartureRow, SegmentedControl, ui.tsx, …
    hooks/  state/             # useAsync, search context
  metro.config.js              # shares ../../src via @shared/*
  app.json                     # scheme "togo", plugins, bundle ids
```

### Shared code (no duplication, no web coupling)
The mobile app imports the repo's platform-neutral modules through the `@shared/*`
alias (→ `../../src`), configured in `tsconfig.json` and `metro.config.js`:
`@shared/types`, `@shared/state/logic`, `@shared/data/seed`, `@shared/data/adapter`,
`@shared/data/supabaseAdapter`, `@shared/data/demoAdapter`, `@shared/lib/{time,id,lookup}`.
None of these touch the DOM, `localStorage`, `import.meta`, or web CSS. The
`DemoAdapter` was refactored to accept an injected persistence sink, so the mobile
app runs the **exact same booking rules** with **AsyncStorage** instead of
`localStorage`.

## Passenger UI (transit-app–inspired redesign)

The passenger experience follows the visual language of everyday transit apps — a
map surface with a draggable bottom sheet, a bold time hierarchy, and compact rows —
using **ToGo's own identity** (deep-forest branding, warm-white surfaces, lime for
selection/primary actions, charcoal text, restrained amber/red for service issues).
No third-party logos, illustrations, or branded assets are copied.

Key pieces (all in `src/components/`, driven by `src/theme.ts` tokens):

- **`BottomSheet`** — draggable sheet on RN `Animated` + `PanResponder` (no extra
  native modules, so it runs in Expo Go). Snaps between collapsed / intermediate /
  expanded; the handle also exposes **accessible expand/collapse buttons** as a
  drag alternative, and it honours the OS **reduce-motion** setting. On Android the
  hardware **Back** button collapses an expanded sheet before leaving the tab.
- **`SchematicMap`** — an **honest schematic**, deliberately *not* geographic. Hubs
  have no published coordinates in this pilot, so pins are laid out illustratively
  along a stylised corridor and the surface is labelled *“Schematic · illustrative,
  not to scale.”* It draws **no invented streets and no “live” bus.** Tapping a pin
  selects a hub; selection stays in sync with the hub chips in the sheet.
- **`DepartureRow`** — a large absolute **pickup time** (tabular figures) beside
  destination/direction, `hub · operator`, fare, seats, and a scheduled/delayed/
  cancelled label. The **origin departure** is shown separately from the **hub
  pickup** time; an old scheduled time is never relabelled as “arriving now.”
- **`SegmentedControl`, `Chip`, `Separator`, `IconButton`** — shared primitives
  used across the redesigned screens (lists prefer hairline separators over nested
  cards).

Screen highlights: **Home** = map + sheet with direction / date / passengers and
hub selection over compact departure rows; **Booking** keeps a short sequence with a
**sticky bottom action** (total fare above the button, above the safe area /
keyboard); the **boarding pass** leads with a large destination + pickup time, hub
name, and a **high-contrast QR on a plain light background**, with one primary
action and cancellation kept accessible but not competing; the **active journey**
renders as presentation stages (Reserved → Check in → Board → On the road → Arrived)
backed by real booking/trip state, preserving the missed-pickup / not-boarded /
cancellation messages, and it keeps the **demo simulation controls visibly
separated** from the real flow. Haptics (`expo-haptics`, no-op on web), screen-reader
labels, and scalable text are applied throughout.

### Real geographic map (later, dev build only)
`react-native-maps` needs a development build and a provider API key and is **not
available in Expo Go**, so the schematic surface is the default. To wire a real map
later: publish hub coordinates on `HubView`, add `react-native-maps` in a dev/EAS
build with an API key, and swap `SchematicMap` for a map component behind the same
`{ hubs, selectedHubId, onSelectHub }` props — no other screen changes are required.

## Startup commands

From `apps/mobile/`:
```bash
npm install            # install mobile dependencies (separate from the web app)
npm start              # start the Expo dev server (Metro) — prints a QR + URLs
npm run start:tunnel   # dev server over a public tunnel (needs egress + Expo login)
npm run android        # open on an Android emulator/device
npm run ios            # open on an iOS simulator (macOS only)
npm run typecheck      # tsc --noEmit
npm run test           # vitest: shared booking rules + native persistence sink
npm run doctor         # npx expo-doctor
npx expo export --platform ios --platform android   # bundle check (no device needed)
```
The existing **web** commands at the repo root are unchanged (`npm run dev`,
`build`, `lint`, `typecheck`, `test`, `db:test`, …).

## Demo vs connected configuration

- **Demo mode (default, no config):** fictional hubs/operators/departures, local
  booking persistence via AsyncStorage, simulated tracking + trip progression, a
  reset-demo control, and a persistent "Demo" label. No credentials, no network.
- **Connected mode:** create `apps/mobile/.env` (or `.env.local`) from
  `.env.example`:
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable-anon-key>
  ```
  `EXPO_PUBLIC_*` values are **inlined into the JS bundle at build/start time** —
  they are public, so use only the URL and publishable/anon key. **Never** put a
  `service_role` key or any privileged secret here. Changing these requires
  **restarting the dev server / rebuilding**; they are not read at runtime from the
  device. Connected mode uses the existing Supabase schema, secured RPCs, scoped
  Realtime subscriptions, and in-app notifications. It never silently falls back to
  demo on a backend error, shows honest pending/failed/offline/stale states, and
  clears the session (and thus private data) on logout. Simulation controls appear
  only in demo mode.

### Session storage security
The Supabase session is stored via `expo-secure-store` (iOS Keychain / Android
Keystore) — OS-level encrypted, app-sandboxed storage — using a small chunking
adapter (`secureSessionStore.ts`) because SecureStore caps a single value at
~2 KB while a session can be larger. Demo data lives separately in ordinary
AsyncStorage and never holds credentials. Both work in Expo Go.

## Testing from an iPhone with Expo Go

**Important:** a repository is not a launchable app. Expo Go loads your app from a
**running Metro dev server** that your phone can reach over the network.

1. On the iPhone, install **Expo Go** from the App Store.
2. On a computer on the **same Wi-Fi** as the phone, run `npm install` then
   `npm start` in `apps/mobile`. Scan the printed QR with the iPhone Camera/Expo Go.
3. If the phone and computer are on different networks, use `npm run start:tunnel`
   (requires internet egress and an Expo account login).

### What works in Expo Go
Everything in this phase is Expo Go-compatible: bottom tabs, all passenger screens,
the QR boarding pass (`react-native-svg`), AsyncStorage demo persistence,
SecureStore sessions, and Supabase auth/data/Realtime over HTTPS/WebSocket. There
is **no** custom native code, so no development build is required to run the app
itself.

### What needs a development build + configured redirect URLs
- **Auth callback deep links** (email confirmation and password-reset return links).
  Supabase's web `detectSessionInUrl` does not apply on native; the app parses the
  incoming `togo://` link itself (`useAuthDeepLinks.ts`). For those links to open
  the app and be accepted, the Supabase project's **Redirect URLs** must include
  the app's scheme/URL, which in practice means a **development build** (or a
  standalone build) rather than plain Expo Go, whose deep-link scheme differs.
  Email/password **sign-in** works in Expo Go without any of this.

## Remote development-server requirements

To open the app from an iPhone you need a dev server the phone can reach:
- **Same-LAN:** computer + phone on one Wi-Fi, `npm start`, scan QR. Simplest.
- **Tunnel:** `npm run start:tunnel` publishes via Expo's tunnel (ngrok). Requires
  outbound internet and an Expo login.

In this repository's remote build environment the tunnel is **impossible** (this
was re-verified, not assumed): the network egress proxy is an allow-list — only
package registries and Anthropic hosts are reachable, while `exp.host`,
`api.expo.dev`, `u.expo.dev`, and the ngrok endpoints all return
`403 CONNECT tunnel failed`. No tunnelling binary (ngrok/cloudflared/ssh) is
present, and there is no inbound/forwarded public URL. The container's `localhost`
is not an iPhone-reachable address. So **no working QR/URL can be produced from
this build environment** — the dev server must run somewhere with open outbound
internet that the iPhone can reach.

## Fastest verified-path option for an iPhone with no laptop: GitHub Codespaces

Because Codespaces has open outbound internet, `expo start --tunnel` there can
publish a public `exp://…exp.direct` URL an iPhone opens over cellular or any
Wi-Fi. A `.devcontainer/devcontainer.json` is included that installs the mobile
dependencies automatically; `@expo/ngrok` is already a dev dependency so the tunnel
starts without an interactive install.

> Honesty: this Codespaces route is **not yet verified end-to-end** from a device —
> it cannot be exercised from the build environment. The steps below are the
> concrete path; the founder must run them from their own GitHub account.

**Phone-only steps (all from the iPhone browser + Expo Go):**
1. Install **Expo Go** (App Store) and update it — the store build tracks the latest
   Expo SDK (57), which matches this project.
2. In the iPhone browser, sign in to **github.com**, open the `mbabazielroy/ToGo`
   repo → **Code ▾ → Codespaces → Create codespace** on the working branch. Wait for
   it to build (it runs `npm install` in `apps/mobile` automatically).
3. In the Codespace's web terminal (the browser page has one), run:
   ```
   cd apps/mobile && npm run start:tunnel
   ```
4. When Metro prints the QR and the `exp://…exp.direct` URL, either scan the QR with
   the iPhone Camera, or copy the `exp://…` URL and paste it into Expo Go's "Enter
   URL manually". The ToGo app loads in demo mode (no Supabase needed).

**Account requirements**
- A **GitHub account** (Codespaces is enabled for personal accounts).
- **No Expo account is required** for a tunnel; if a prompt appears, a free Expo
  account also works. Demo mode needs no Supabase and no login.

**Possible usage charges**
- GitHub Codespaces has a monthly **free allowance** for personal accounts
  (typically 120 core-hours + 15 GB-months; a 2-core machine ≈ 60 h/month). Beyond
  the free allowance it is **billed to the GitHub account**. This config never
  provisions paid resources on its own, but *running* a Codespace consumes the quota.

**Server-lifetime limitations**
- A Codespace **auto-suspends after ~30 minutes idle** and stops counting compute
  while stopped; the tunnel dies when the Codespace stops or the terminal is closed.
- Restarting the Codespace and re-running the tunnel command gives a **new** URL.
- **Stop or delete the Codespace** from github.com when done to avoid consuming the
  allowance.

## Installed versions (authoritative — from `apps/mobile/package-lock.json`)

| Package | Locked version |
| --- | --- |
| expo | 57.0.21 |
| react-native | 0.86.3 |
| react / react-dom | 19.2.3 |
| expo-router | 57.0.20 |
| react-native-safe-area-context | 5.7.0 |
| react-native-screens | 4.26.2 |
| react-native-svg | 15.15.4 |
| react-native-qrcode-svg | 6.3.24 |
| expo-haptics | 57.0.2 |
| @react-native-async-storage/async-storage | 2.2.0 |
| expo-secure-store | 57.0.3 |
| @supabase/supabase-js | 2.116.0 |

These are consistent with Expo SDK 57's bundled set (`expo/bundledNativeModules.json`
pins react-native `0.86.3` and react `19.2.3`). **Expo Go from the App Store tracks
the latest published SDK (57)**, so an up-to-date Expo Go matches this project. (This
is Expo's stated Go policy; it was not confirmed against the live App Store listing
from this network-restricted environment — update Expo Go before testing.)

## Verification performed (this environment)
- Authoritative versions read from the **lockfile** (table above) and cross-checked
  against `expo/bundledNativeModules.json` — no contradiction.
- `tsc --noEmit` (mobile) — passes.
- `vitest` (mobile) — 4 tests pass: shared reserve/capacity/cancel rules, outcome
  classification (missed_pickup / not_boarded), and single-use boarding — all
  through the injected native persistence sink.
- `expo-doctor` — **19/21 checks pass**, re-run this phase. The 2 failures are
  **network-blocked and remain UNVERIFIED**: the Expo config-schema host and the
  React Native Directory API are not on the egress allow-list (they return the
  proxy's "Host not in allow-list" response). They are not project defects.
- `expo export --platform ios --platform android` — succeeds; both Hermes bundles
  build, confirming the shared `@shared/*` imports resolve and the app bundles for
  iOS and Android.
- **Redesign visual check via a web preview only.** `expo export --platform web`
  (react-native-web) was served locally and rendered in headless Chromium at phone
  width to review Home, booking, boarding pass, and hub details. These are a
  **web preview of the React Native screens — not native iOS/Android renders**, and
  are **not** a substitute for on-device testing. The custom `PanResponder` sheet
  gestures and `expo-haptics` do not exercise on web.
- Tunnel reachability **re-confirmed impossible here**: `exp.host` / `api.expo.dev` /
  ngrok endpoints all return `403 CONNECT` through the egress proxy; no tunnelling
  binary is installed; no inbound public URL exists.
- **No native simulator or physical device was used.** Authentication callbacks and
  Expo Go loading were **NOT** tested on a device. No QR/tunnel/working connection
  was produced from this environment.

## Later path to Android and iOS builds (EAS)
Running in Expo Go covers this phase. Installable store/standalone builds use EAS:
```bash
npm i -g eas-cli
eas login                 # requires a free Expo account
eas build:configure       # creates eas.json
eas build -p android --profile preview   # APK/AAB (Expo cloud credentials)
eas build -p ios --profile preview       # requires an Apple Developer account ($99/yr) for signing
```
This needs an Expo account and, for iOS, Apple Developer signing — **none are
provisioned by this task**. An `eas.json` is included as a documented starting
point; it does not imply an installable build exists.

Do not commit `.env` / `.env.local`, `node_modules/`, `.expo/`, or `dist/` (all
git-ignored under `apps/mobile`).
