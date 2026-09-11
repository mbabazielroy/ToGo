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
    components/                # native UI kit: DepartureRow, SelectSheet,
                               #   Screen (+ ModeTag), ui.tsx, …
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

## Passenger UI — composition & visual system

The passenger app uses a restrained, **Apple-inspired grouped-list** system: white
cells on a light neutral background (`#f2f2f7`), thin hairline separators, native
system typography, and forest green reserved for primary actions and selected
states. There are no lime fills, tinted backgrounds, gradients, or heavy shadows.
It stays **list-first** — choosing a pickup hub and seeing departures is the whole
first screen; there is no decorative map (hubs have no published coordinates).

**Visual system** (`src/theme.ts`, logical RN units — not screenshot pixels):
`bg`/`surface`/`surfaceAlt` neutrals; text ramp `ink` (near-black) → `inkSoft` →
`muted`, all kept ≳4.5:1 on white (`faint` is for chevrons only). Spacing scale
4/8/12/16/24/32 with a 16 screen gutter; body 17, secondary 15, footnote 13, titles
28, prominent times 34; controls 44–50 high; corners 10–14 (sheet 20). Structure is
carried by separators and section headers, never stacked cards or shadows.

Key pieces (`src/components/ui.tsx` unless noted):

- **`Group` + `SectionHeading`** — the grouped-list primitives: a white rounded
  block of rows, a small grey caps header above it. Used everywhere instead of
  bordered cards.
- **`NavBar`** — standard header with a leading back chevron and centred title
  (booking, hub, boarding pass).
- **`Segmented`** — iOS-style segmented control (grey track, white selected thumb),
  used for direction in the Route sheet.
- **`DepartureRow`** — prominent pickup time (left), operator/destination, secondary
  `hub` line with exceptions (delayed / cancelled / low seats) only when they apply,
  fare right-aligned. Everything is single-line with graceful truncation of long
  operator names; times and fares never truncate.
- **`SelectSheet`** (`SelectSheet.tsx`) — focused `Modal` sheet (backdrop / close /
  Android Back all dismiss) for the Route (direction + date) and Pickup-hub pickers,
  rendered as grouped rows with a forest checkmark on the selected item.
- **`Screen` + `ModeTag`** — compact identity header; the **Demo** indicator is a
  small tappable chip that explains itself (no banner). A concise *“Demo reservation
  — no real seat booked.”* appears at confirmation.
- Buttons carry clear emphasis: filled-forest **primary**, tinted **secondary**
  (`accent`), and red **destructive** text.

Screen highlights: **Home** = identity bar + `Find a departure` title, one grouped
search form (Route / Date / Pickup / Passengers), then a grouped departures list.
**Booking** = `NavBar` + grouped Journey summary (correct pickup hub + city →
**destination city**, operator, date, times), grouped passenger fields, a grouped
fare breakdown, and a fixed footer (Total above a filled **Confirm reservation**)
above the safe area with keyboard handling. **Boarding pass** = an understated white
ticket (destination + pickup time as anchors, neutral status pill, high-contrast QR
on white with a readable code and *“Show this code to the conductor.”*, compact
passenger/fare line), the **current step + next instruction** in its own card with a
single `Check in` action, and the full timeline behind **Show journey steps**; demo
controls are a separate group. **Hub details** = `NavBar` “Pickup hub”, the name once
as the title, address/hours + a discreet `Demo location`, `Where to wait`, a
facilities grid, grouped departures, and a fixed `Use this pickup hub`. **Hubs / My
Trips / Notifications / Account** all use the same grouped rows and separators.

### Destination / arrival correctness (`@shared/data/journey`)
A trip's `stops` are **pickup hubs in the origin city only**; the journey's
destination is the corridor endpoint **city** arriving at `trip.destinationArrival`.
`tripJourney(trip, pickupHubId)` is the single source of truth for the endpoints and
is used by search, booking review, the persisted booking, and the boarding pass, so
they agree. This fixes the earlier bug where the last pickup hub (e.g. *Natete
Junction Stop, Kampala*) was shown as the arrival of a Kampala → Mbarara trip.
`dropoffStopFor(trip)` supplies only the reservation's dropoff argument (ignored in
demo, validated in connected) and is never used to label the arrival. Guarded by
`src/data/journey.test.ts`.

### Real geographic map (later, dev build only)
A genuine map needs `react-native-maps`, a dev/EAS build, and a provider API key —
**not available in Expo Go** — plus published hub coordinates (none exist in this
pilot). Until then the app stays list-first and never invents operational hub
coordinates or draws streets.

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

## Preview mode — a working local app (no Supabase required)

Supabase is created later. To open a **fully working** app now — for design review,
demos, and exercising the whole operational flow — start in **preview (demo) mode**,
which uses seeded fictional data and on-device persistence. A discreet **Preview**
indicator explains the data is simulated; connected mode and its honest
setup/connection-error screens are untouched, and a configured connected app is
**never** silently switched to local data.

**Web preview** (from the repo root):
```bash
npm run preview:local        # = VITE_TOGO_DEMO=1 vite  → http://localhost:5173
# alias: npm run dev:preview
```
Opens the passenger app with a role switcher (top-right): **Passenger**, **Hub
attendant**, **Conductor**, and the **Dispatcher console** (Operator). All four
share the same local dataset, so a passenger reservation immediately appears in the
attendant, conductor, and dispatcher views on the same device.

**Mobile preview** (from `apps/mobile/`):
```bash
npm run preview              # = EXPO_PUBLIC_TOGO_DEMO=1 expo start   (QR + URLs)
npm run preview:web          # preview the RN screens in a browser
npm run preview:tunnel       # preview over a public tunnel (needs egress + Expo login)
```
The native app opens the passenger experience; the **Staff workspace** (Account →
*Staff workspace*) offers Driver, Conductor, and Hub-attendant personas. Selecting a
preview persona **only filters simulated data on the device — it grants no backend
permission** (in connected mode the app instead shows only the workspaces the signed-in
account is actually assigned to, resolved on the server).

> Preview state is per platform: the native app (AsyncStorage) and the web app
> (`localStorage`) each keep their own local dataset and do **not** sync with each
> other without a backend. Reset from Account → *Reset preview* (native) or the
> Operator/Account reset (web).

## Connected mode (default) vs demo

**Connected mode is the normal entry point.** Create `apps/mobile/.env` (or
`.env.local`) from `.env.example`:
```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable-anon-key>
```
`EXPO_PUBLIC_*` values are **inlined into the JS bundle at build/start time** — they
are public, so use only the URL and publishable/anon key. **Never** put a
`service_role` key or any privileged secret here. Changing these requires
**restarting the dev server / rebuilding**; they are not read at runtime from the
device.

- **No configuration → a polished "Setup needed" screen** (with Retry). The app
  never silently opens demo mode.
- **Configured but unreachable/mis-migrated → a "Can't reach ToGo" screen** with
  Retry (a light HEAD probe of the public `hubs_public` view decides this).
- **Configured + reachable → the connected app.** Public browsing (hubs and
  departures) works signed-out; reserving, My Trips, notifications, and the account
  require sign-in, and the selected journey is preserved through sign-in (the booking
  URL carries trip + hub + passengers). Uses the existing schema, secured RPCs, scoped
  Realtime, and in-app notifications; shows honest pending/failed/empty/stale states;
  live location is shown only when real tracking data exists, otherwise a scheduled
  estimate. Payment stays "Pay at boarding" — no payment is processed.

- **Demo mode is development/test only** and must be opted into explicitly with
  `EXPO_PUBLIC_TOGO_DEMO=1`: fictional fixtures, AsyncStorage persistence, simulated
  tracking + trip progression, a reset-demo control, and a "Demo" label. It is never
  the fallback for a missing/unavailable backend.

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
   URL manually".

**Opening the CONNECTED app on the iPhone.** Connected mode is the default, so it
needs the two public values present when Metro starts. In the Codespace terminal,
before `npm run start:tunnel`, create `apps/mobile/.env` with your Supabase project
URL and publishable/anon key (see `.env.example`), then start the tunnel. Because
`EXPO_PUBLIC_*` is inlined at start time, **restart Metro after changing `.env`**.
Without configuration the app opens to the honest **"Setup needed"** screen rather
than demo. To preview the visual design without a backend, start Metro with
`EXPO_PUBLIC_TOGO_DEMO=1` for the opt-in demo prototype.

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
- `vitest` (shared) — 28 tests pass: reserve/capacity/cancel rules, outcome
  classification (missed_pickup / not_boarded), single-use boarding, and the new
  **journey-endpoint regression suite** (`src/data/journey.test.ts`) that locks the
  destination to the corridor city and the arrival to `destinationArrival`.
- `expo-doctor` — **19/21 checks pass**, re-run this phase. The 2 failures are
  **network-blocked and remain UNVERIFIED**: the Expo config-schema host and the
  React Native Directory API are not on the egress allow-list (they return the
  proxy's "Host not in allow-list" response). They are not project defects.
- `expo export --platform ios --platform android` — succeeds; both Hermes bundles
  build, confirming the shared `@shared/*` imports resolve and the app bundles for
  iOS and Android.
- **Visual check via a web preview only.** `expo export --platform web`
  (react-native-web) was served locally and rendered in headless Chromium to review
  Home, booking, boarding pass, hub details and My Trips at **390×844**, a **narrow
  340×760**, and an **enlarged-UI proxy (1.35× page zoom)**. Checked: no clipped
  time/fare/action, no overlapping controls (the grouped form keeps a gap between
  label and value at large text), correct destination across search → review →
  boarding pass, and consistent grouped typography/spacing. Long operator names
  truncate to a single line with an ellipsis by design. These are a **web preview of
  the React Native screens — not native iOS/Android renders.** True OS Dynamic Type,
  `Modal`/gesture behaviour, translucency, and `expo-haptics` are **not exercised on
  web and remain unverified**; the 1.35× zoom is a layout proxy, not RN font scaling.
  Translucent nav/tab surfaces are implemented as their **opaque fallback** (no
  `expo-blur` dependency added); real blur is an optional dev-build enhancement.
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
