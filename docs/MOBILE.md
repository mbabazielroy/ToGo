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
    book/[tripId].tsx          # booking review + reserve
    trip/[bookingId].tsx       # boarding pass (QR), check-in, cancel, tracking
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
    components/  hooks/  state/ # native UI kit, useAsync, search context
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

In this repository's remote build environment the tunnel host (`exp.host`) is
blocked by the network egress policy, and the container's `localhost` is not
reachable from an external phone, so **no working QR/URL can be produced from
here** — the dev server must be started somewhere the iPhone can reach (a laptop on
the same Wi-Fi, or any host with open egress for the tunnel).

## Verification performed (this environment)
- `tsc --noEmit` (mobile) — passes.
- `vitest` (mobile) — 4 tests pass: shared reserve/capacity/cancel rules, outcome
  classification (missed_pickup / not_boarded), and single-use boarding — all
  through the injected native persistence sink.
- `expo-doctor` — 19/21 checks pass; the 2 failures are network-blocked in this
  environment (Expo config-schema host and the React Native Directory API), not
  project issues.
- `expo export --platform ios --platform android` — succeeds; both Hermes bundles
  build, confirming the shared `@shared/*` imports resolve and the app bundles for
  iOS and Android.
- **No native simulator or physical device was used.** Authentication callbacks
  were **not** tested on a device. No QR/tunnel could be produced here (see above).

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
