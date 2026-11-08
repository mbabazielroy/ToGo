# ToGo — App Store and Google Play launch checklist

Two apps are built from `apps/mobile`:

| App | Variant | iOS bundle / Android package | EAS profile |
|---|---|---|---|
| **ToGo** (passengers) | `passenger` | `app.togo.mobile` | `production` |
| **ToGo Staff** (crew + operations) | `staff` | `app.togo.staff` | `production-staff` |

Store builds always run in **connected mode** (real Supabase). Preview mode
(`EXPO_PUBLIC_TOGO_DEMO=1`) is for development only and must never ship: Apple
rejects demo apps (guideline 2.1), and preview data is fictional.

---

## 1. Done in the app

| Requirement | Where |
|---|---|
| App icon (1024², no transparency) and Android adaptive + monochrome icons, separate for each app | `apps/mobile/assets/` |
| Splash screen for each app | `app.json`, `app.config.js` |
| Version 1.0.0; build numbers and version codes are kept and auto-incremented by EAS (`appVersionSource: remote`) | `app.json`, `eas.json` |
| In-app **account deletion** (Apple 5.1.1(v), Google Play account-deletion policy) | Account → Delete account; server function `supabase/migrations/0019_delete_my_account.sql` |
| In-app **privacy policy** and **terms of use**, linked from onboarding, sign-up, Account, crew Profile and staff sign-in | `app/legal.tsx`, `src/legal/content.ts` |
| Consent line at onboarding and account creation | `app/onboarding.tsx`, `app/auth.tsx` |
| Permission strings say exactly what each permission is for | `app.json` plugins |
| No background location; microphone, background location and storage permissions blocked on Android | `app.json` → `android.blockedPermissions` |
| iOS privacy manifest (required-reason APIs and collected data); staff app adds precise location | `app.json`, `app.config.js` |
| Export compliance answered (`ITSAppUsesNonExemptEncryption: false`, HTTPS only) | `app.json` |
| iPhone only (no iPad build, so no iPad screenshots needed) | `ios.supportsTablet: false` |
| Staff accounts can't be created in the app (operators issue them) | `app/auth.tsx` |
| No "pilot", "illustrative" or "demo" wording in connected mode | checked in the release bundles |
| Android Google Maps key read at build time | `app.config.js` (`GOOGLE_MAPS_ANDROID_API_KEY`) |
| Each app's permission prompts describe only what that app does; the passenger app doesn't request the camera on Android | `app.config.js` (`PERMISSION_TEXT`) |
| Store builds refuse to build in preview mode, without a backend, or without a privacy URL and support email | `app.config.js` (`assertStoreReady`) |
| Release builds never show developer setup text, even if misconfigured | `src/components/ConnectionScreen.tsx` |
| Hosted privacy policy, terms and **account-deletion page** (Google Play requires a deletion URL that works without the app), generated from the in-app text on every web build | `scripts/build-legal-pages.mjs` → `/legal/privacy.html`, `/legal/terms.html`, `/legal/delete-account.html` |
| CI on every push; release workflow for EAS build and submit | `.github/workflows/ci.yml`, `.github/workflows/eas-release.yml` |

## 2. Before the first store build (your accounts and decisions)

1. **Legal entity and contact.** Set `EXPO_PUBLIC_LEGAL_NAME`, `EXPO_PUBLIC_LEGAL_ADDRESS`
   and `EXPO_PUBLIC_SUPPORT_EMAIL` (EAS environment variables for the app builds, and
   the web host's environment for the hosted pages); they fill the "Who we are"
   section, and store builds refuse to build without them. Have a lawyer review both documents
   against Uganda's Data Protection and Privacy Act 2019. Register with the Personal
   Data Protection Office if required.
2. **Host the website and policies.** Deploy the website (Vercel, `vercel.json`) with
   `EXPO_PUBLIC_SUPPORT_EMAIL` set; it serves `/legal/privacy.html`, `/legal/terms.html`
   and `/legal/delete-account.html`. Use those as the store privacy URL and the Play
   "Delete account" URL, and set `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`
   and `EXPO_PUBLIC_SUPPORT_EMAIL` for the app builds.
3. **Supabase.** Create the production project, run every migration in
   `supabase/migrations` in order (through `0020`), and set
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS environment
   variables for the `production` and `production-staff` profiles. Set the auth
   redirect URLs to `togo://**`, `togostaff://**` and `‹website›/console/auth/reset`.
   Set up push alerts (function, webhook, Firebase `GOOGLE_SERVICES_JSON` for
   Android): `docs/BACKEND.md` → Push alerts.
4. **Google Maps key** for Android: create one in Google Cloud, restrict it to the
   two package names and their signing SHA-1, and add it as the EAS secret
   `GOOGLE_MAPS_ANDROID_API_KEY`.
5. **Developer accounts.** Apple Developer Program ($99/yr) and Google Play Console
   ($25 once). Create both apps in App Store Connect and Play Console with the bundle
   IDs above.
6. **Listing text, review notes and screenshots:** `docs/STORE_LISTING.md`.
7. **Crash reporting (recommended).** Create a free Sentry account and a React
   Native project for each app (or one shared project). Set its DSN as the EAS
   variable `EXPO_PUBLIC_SENTRY_DSN` for both production profiles, and on the web
   host (the privacy page mentions crash reports only when it is set, so the website
   and the apps must match). For readable stack traces also set `SENTRY_ORG`,
   `SENTRY_PROJECT` and the secret `SENTRY_AUTH_TOKEN`. Without the DSN the apps send
   nothing. Answer the store privacy questions in §4 to match.
8. **Reviewer accounts.** Make a passenger account and a staff account (assigned to a
   test trip and hub) on production, with departures scheduled during the review
   window. Put the credentials in App Review notes and Play "App access".

## 3. Build and submit

### CI/CD (GitHub Actions)

- **CI** (`.github/workflows/ci.yml`) runs on every push and pull request: web and
  shared typecheck, lint, tests and build; mobile typecheck, lint, tests, Expo Doctor,
  a store-config check of both apps, a release bundle export of both apps for iOS and
  Android, and the Postgres RLS and concurrency suites.
- **Release** (`.github/workflows/eas-release.yml`): run it from the Actions tab
  (choose app, platform, `preview` or `production`, and whether to submit), or push a
  tag `v1.0.0` matching `app.json` → builds both apps and submits them to TestFlight
  and Play internal testing. It reruns the checks first.
- One-time setup:
  1. GitHub → Settings → Secrets → Actions: add `EXPO_TOKEN` (expo.dev → Access tokens).
  2. ~~Create the EAS projects~~ Done: `@elly1/togo-mobile` and `@elly1/togo-staff`,
     linked in `apps/mobile/app.config.js`.
  3. Create EAS environment variables for `production` and `preview` (expo.dev →
     project → Environment variables) listed in `eas.json`.
  4. `npx eas-cli credentials` → add an App Store Connect API key (iOS submit) and a
     Google Play service-account JSON (Android submit). Upload the **first** Android
     build of each app to Play Console by hand; automated submits work after that.

### By hand

```bash
cd apps/mobile
npx eas-cli build -p all --profile production         # ToGo
npx eas-cli build -p all --profile production-staff   # ToGo Staff
npx eas-cli submit -p ios --latest
npx eas-cli submit -p android --latest
```

Ship to TestFlight and a Play **internal testing** track first, and run the device
test below, before sending either app for review.

## 4. Store listing answers

**App Store privacy label ("App Privacy")**: Data linked to the user, used for App
Functionality only, not used for tracking:
- Contact info: name, email address, phone number
- Identifiers: user ID
- Other data: trip reservations
- ToGo Staff only, also: precise location (driver, while a trip is running)
- ToGo, for push alerts: Identifiers → Device ID (the push token), linked to the
  user, App Functionality, not tracking. (Apple doesn't require push tokens to be
  declared in every case; declaring them is the cautious choice.)
- If crash reporting is on (`EXPO_PUBLIC_SENTRY_DSN` set): Diagnostics → Crash data,
  **not** linked to the user, App Functionality, not tracking. (The build adds the
  matching entry to the iOS privacy manifest.)

**Google Play Data safety**: Collected: name, email, phone (optional), user IDs,
"other app activity" (reservations), "Device or other IDs" (ToGo's push token, for
app functionality); Staff app also approximate/precise location. Not
shared with third parties for their own use; encrypted in transit; users can request
deletion (in-app, Account → Delete account). If crash reporting is on, also: App info
and performance → Crash logs and Diagnostics, collected, not shared, for analytics /
app functionality, processed by Sentry as a service provider.

**Content rating**: no objectionable content → 4+ (Apple) / Everyone (IARC).
**Category**: Travel (ToGo), Business (ToGo Staff).

**ToGo Staff and Apple.** An app only staff can sign in to may be rejected as an
internal tool (guideline 3.2). Options: publish it as an **Unlisted** app (request
through Apple), distribute through **Apple Business Manager**, or accept a public
listing with a reviewer account. On Google Play, use a closed testing track or
**Managed Google Play** for a private app.

## 5. Device test before submitting (real phones, production backend)

- [ ] Fresh install → welcome → onboarding → privacy link opens → Start travelling
- [ ] Create account and confirm with the 8-digit code; sign in
- [ ] Forgotten password: reset with the code read on another device, then with the link on the same phone; the other phone is signed out and a "password changed" email arrives
- [ ] Account → Security: change password (wrong current password refused); Sign out on all devices
- [ ] iOS offers to save the password and fills the emailed code from Mail
- [ ] Reserve, view boarding pass; check-in shows "opens at …" until 2 h before pickup
- [ ] Allow notifications: "Check-in is open" and "Time to head to …" reminders arrive and open the pass; cancelling removes them
- [ ] Driver starts the trip, location sharing turns on; the passenger gets "Your bus is on its way", the pass says the bus is sharing its position, and the bus moves on the map within seconds of each update
- [ ] Walk towards the pickup hub with the pass open: the blue dot follows and "You're … from …" counts down; leave the screen and the location arrow in the status bar goes away
- [ ] With location not yet allowed, the pass shows a button and asks only when it's tapped
- [ ] Conductor scans the QR (camera permission prompt), confirms boarding
- [ ] Attendant checks in by reference
- [ ] Delay and cancellation reach the passenger's alerts
- [ ] Cancel a reservation; seats are released
- [ ] Delete account; sign-in no longer works and the seats are released
- [ ] Deny location and camera: the app keeps working and explains what's missing
- [ ] Airplane mode: errors are readable and Retry works
- [ ] Larger text (Dynamic Type / font scale) and VoiceOver/TalkBack on the main screens

## 6. Known limits at launch

- Trip reminders (check-in open, time to leave) are local notifications on the phone. "On its way", delay and change alerts are pushed once the push function and webhook are set up (`docs/BACKEND.md`).
- The passenger's own position is used only while a map or their pass is open, and stays on the phone.
- The Live map shows real GPS for the passenger's own bus only; other buses are placed from the timetable (passengers can only read GPS for trips they're booked on).
- Location sharing runs while ToGo Staff is open (any tab), with the screen kept awake; it pauses if the app is closed or backgrounded.
- Payment is cash to the conductor; the app takes no payments.

## After the apps are published

Set `EXPO_PUBLIC_APP_STORE_URL` and `EXPO_PUBLIC_PLAY_STORE_URL` on the web host and
redeploy: the website's "Coming soon" buttons become download links.
