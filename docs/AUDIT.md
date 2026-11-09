# ToGo audit

_Third pass, 9 November 2026 · ToGo 1.0.0, ToGo Staff 1.0.0 and the website · branch `claude/togo-bus-terminal-0o4g26`_

## Summary

**Third pass (9 November 2026): full audit.** Every automated check passes, and
the database ran on a real PostgreSQL 17 server here for the first time. That
found one critical and two high problems in what a hosted Supabase project
exposes, all fixed in migration `0023_lock_down_api.sql`:
- anyone could edit pickup hubs;
- anyone could send any user a notification;
- anyone could write booking history.

It also found that the website's security headers were never actually sent, and
three app issues. The whole pass is described under "Third pass: full audit" below.
**Apply migration 0023 to the production project before launch.**

**Earlier passes:**

Every code item from the first audit is done except H4, testing on real phones,
which needs you. Both projects now report no known vulnerabilities. End-to-end tests
drive the real screens on every push. Each app ships only its own screens.

The website is now a public information page about the app, with the operations
console kept at `/console` for staff.

What's left is mostly outside the code:
- Testing on real phones.
- Setting up the production Supabase project, the push alerts and the store accounts.
- Trying the parts that need those against real services: sign-in emails, push
  alerts and the console.

| Area | Rating | Notes |
|---|---|---|
| App Store / Play policy | Good | Privacy policy and store answers now cover push alerts and crash reports |
| Security | Good after 0023 | API surface locked down and tested against Supabase's real default grants (0023); website headers now sent with a CSP. Accounts reviewed against NIST SP 800-63B and OWASP ASVS (see below); PKCE sign-in links; push tokens locked to their owner and tested; push function checks a shared secret; website security headers. Two-factor sign-in for staff is still to do (N5) |
| Privacy | Good | Crash reports stripped of personal data; push tokens removed on sign-out and account deletion; no tracking or ads |
| Reliability | Good | Offline boarding pass, crash reporting, failures that matter are now reported |
| Accessibility | Good, needs a device check | Screen-reader roles in place; large text and VoiceOver/TalkBack still to try on a phone |
| Performance | Good | Each app is 170–260 KB smaller without the other app's screens; the info page loads about 18 KB of its own code |
| Code health | Good | ESLint 10, Vite 8, Vitest 5; 86 + 63 unit tests, 13 end-to-end tests and 118 database checks plus the concurrency race in CI |
| Dependencies | Good | `npm audit` finds 0 vulnerabilities in both the website and the phone app |

## First audit: status

| Item | Status | What was done |
|---|---|---|
| H1. Boarding pass offline | Done | Upcoming passes are saved on the phone and shown, marked as saved, on the pass, on My trips and on the no-connection screen |
| H2. Sign-in links | Done | PKCE flow in the apps and the console; links carrying tokens are ignored |
| H3. Crash reporting | Done, needs your Sentry key | Sentry in release builds, personal data stripped first; privacy policy and store answers updated |
| H4. Device testing | **Open: needs you** | Checklist in `docs/STORE_LAUNCH.md` §5 |
| M1. Push alerts for delays | Done, needs setup | Delays, cancellations, schedule changes and incidents are pushed; see "Push alerts" in `docs/BACKEND.md` |
| M2. End-to-end tests | Done | Playwright runs the real screens (web build, preview mode) for both apps and a full passenger-to-conductor journey; CI job `e2e` |
| M3. Website routing library | Done, then removed | Upgraded to React Router 7; the console still uses it, and the info page needs none |
| M4. Separate code per app | Done | The bundler leaves the other app's screen folders out (`metro.config.js`) |
| L1. Build-tool advisories | Done | Patched `glob`, `minimatch` and `uuid` via npm overrides; Expo Doctor, fingerprints and release exports checked |
| L2. Silent failures | Done | Failed saves, profile syncs, keep-awake and location start are reported; harmless ones (vibration, links) stay quiet |
| L3. Lint configuration | Done | ESLint 10 with the flat config in both projects |

## Fixed in this pass

| Finding | Fix |
|---|---|
| The website was a second copy of the booking app | Replaced with an information page: what ToGo does, how it works, features, a section for operators, FAQ, store buttons (showing "Coming soon" until the links are set) and the legal pages |
| The operations console only existed inside that web app | Kept at `/console`, staff sign-in only (no public sign-up), operator and admin tools only, marked `noindex` |
| If location tracking failed to start, the driver screen still said "Sharing bus location" | It now shows "Couldn't start location" and the failure is reported |
| A push tapped while the app was closed didn't open the boarding pass | The app now opens the pass for alerts tapped from a closed app |
| The console's password reset accepted 6 characters | 8, the same as the apps |
| The console told operators reservations were "demo" | Rewritten for real use |
| The website's Docker image used Node 20 and had no `/console` routing | Node 22, routing for `/console`, security headers |

## Added after this pass: live location

| Finding | Change |
|---|---|
| The passenger's dot was one reading, taken only when they tapped "Find my nearest hub", and only on the Live map | The dot follows them while a map or their pass is open, on the Live map, the pass and the hub screen. It stops when they leave the screen or the app; nothing runs in the background and the position isn't sent anywhere |
| Nothing told a passenger how far they were from their pickup | The pass and hub screen show "You're 850 m from Nakawa Green Hub", updating as they walk, and work without a connection. If location isn't allowed yet, there's a button rather than a permission prompt on opening the screen |
| A new bus GPS fix reached the passenger only on the next 30-second refresh | The pass and Live map now receive each fix as it's stored (realtime), so the bus moves within seconds |
| The pass and the Live map disagreed on when a bus fix was too old (2 vs 5 minutes) | One rule, 3 minutes, for both |
| Passengers weren't told when their bus set off | "Your bus is on its way" (pickup hub and expected time) when a trip first starts, however it's started; pushed to the phone, once per booking (`0022_trip_started.sql`). The pass then offers "Track the bus live" |

## Third pass: full audit

**What ran:**
- **Automated checks:** every one, plus `npm audit` and Expo Doctor.
- **Database:** all 23 migrations, then the full access-rule suite and the
  two-people-one-seat race on a real PostgreSQL 17 server. The test setup now
  mirrors the grants a hosted Supabase project gives by default.
- **By hand, in a browser:**
  - the passenger app: hubs, booking for two, the pass and notifications;
  - the staff app: driver, conductor and operations;
  - the website, legal pages and console.

| # | Severity | Finding | Fix |
|---|---|---|---|
| A1 | Critical | Hosted Supabase grants every new object in `public` to signed-out visitors. The passenger views run with their owner's rights and `hubs_public` is a simple view, so anyone could rename an approved hub, change its directions or move it on the map, which would send passengers to the wrong place. The tests never saw this, because their setup didn't copy Supabase's default grants | `0023`: the three passenger views are read-only for everyone. The test setup now applies Supabase's default grants, and `rls_cases7.sql` tries the attack and checks every view |
| A2 | High | The internal helper `_notify` could be called by anyone, so anyone could send any user an in-app alert, and with push set up a phone notification (for example a fake "send money to…" message) | `0023`: internal helpers and trigger functions can't be called through the API |
| A3 | High | `_log_event` could be called by any signed-in user to write booking history | Same as A2 |
| A4 | Medium | 25 functions added after migration 0010 (management, staff workspace, push, account deletion) could be called by signed-out visitors. Each checks the caller itself, so nothing leaked, but they shouldn't be reachable | `0023`: signed-out visitors can call only `is_operator_member`, which the public operators rule needs. Every RPC needs a signed-in user, and new functions no longer get that grant by default |
| A5 | Medium | `TRUNCATE` (which skips row-level security) was granted on every table. The API doesn't expose it, but nothing should hold it | Revoked from the API roles |
| A6 | Medium | The website's security headers were never sent: nginx drops server-level `add_header` lines in any `location` that sets its own, and every location did | The headers live in `deploy/security-headers.conf`, which every location includes. Added a Content Security Policy (scripts only from the site; data only from the site and `*.supabase.co`), Permissions-Policy and HSTS |
| A7 | Medium | On web, choice dialogs (driver "Report delay", conductor "Leave hub", operations "Add delay") used the browser's `prompt()` with "Type a number". Some browsers block `prompt()`, and there the screen crashed | `ask()` now shows an in-app dialog on web with real buttons, Escape to cancel and the right roles for screen readers. Phones still use the system alert. The end-to-end tests press its buttons |
| A8 | Low | New departure: when a vehicle was already busy, the error appeared at the bottom of the long form, off screen, so "Schedule departure" seemed to do nothing. The error also stayed after the choice was changed | The error shows in the footer next to the button and clears when any choice changes |
| A9 | Low | In local development `/console` showed the home page and console links like `/console/auth/reset` didn't open the console (production nginx was fine) | The dev and preview servers route `/console` the way nginx does |
| A10 | Low | CI tested the database on PostgreSQL 16; new Supabase projects run 17 | CI uses 17 |

**Checked and sound:**
- **Database protection:** every table has row-level security, and every
  definer function has a fixed `search_path`.
- **Overbooking:** two people racing for the last seat gets exactly one booking;
  the other gets `SOLD_OUT`.
- **Push function:** checks its secret in constant time and logs nothing personal.
- **Privacy policy:** covers push addresses, the bus's live location and the
  passenger's own location.
- **Dependencies:** no known vulnerabilities.
- **Validation:** times in the past and vehicles that are already busy are refused.
- **Bookings:** the fare total is right for several seats.
- **Boarding pass:** QR codes stay black on white in dark mode.

## Added after the second pass: accounts and sign-in

Reviewed sign-up, sign-in, password recovery and sessions in both apps and the
console against NIST SP 800-63B (passwords) and OWASP ASVS (authentication and
sessions).

Already sound and kept:
- Email links are PKCE: they work only where they were asked for, so a forwarded or
  crafted link can't sign someone in.
- Phone sessions are stored in the Keychain or Keystore.
- Wrong email and wrong password get the same message, and "forgot password" never
  says whether an account exists.
- Staff accounts can't be created in the staff app or the console.

| Finding | Change |
|---|---|
| The server accepted 6-character passwords (only the apps asked for 8), and anything at all was accepted if it was long enough | Server minimum 8 (`config.toml`). The apps and console refuse common passwords and ones built from the person's email or name, show why as they type, with a strength meter and show/hide button, and allow pasting and password managers. Leaked-password protection listed for production |
| Email confirmation was off | On. Sign-up ends with an 8-digit code from the email; "Send a new code" waits 60 s between emails |
| A reset link only worked on the phone that asked for it, and had never been tried on a device | The reset email carries an 8-digit code that works on any device; the code and new password are entered on one screen. Codes and links last 30 minutes and work once |
| Resetting or changing a password left every other session signed in | All other sessions are signed out, and the owner is emailed "your password was changed" |
| Changing the password in Account needed no current password: anyone holding an unlocked phone could take over the account | The current password is checked first, and the server requires a recent sign-in (`secure_password_change`). Staff can now change their password in the crew profile too |
| Sign out on a phone signed the person out everywhere, including the console | Sign out ends this device only; "Sign out on all devices" is in Account → Security |
| The console stayed signed in indefinitely | Signs out after 30 minutes without activity, and says so |
| Supabase error text was shown as it came | Every auth error has a plain message (`src/lib/authRules.ts`), none of which reveals whether an account exists |
| Emails were Supabase's defaults | ToGo templates with the code and link, an expiry note and a "we never ask for this code" line, plus "password changed" and "email changed" notices (`supabase/templates/`) |
| `npm run backend:up` failed on the current Supabase CLI (3.0): `[inbucket]` and PostgreSQL 16 are no longer accepted | `[local_smtp]` and PostgreSQL 17; the CLI now reads the config and every template |

## Recommended next

### High

- **H4. Device testing** (from the first audit). Install both store builds on an
  iPhone and an Android phone and run `docs/STORE_LAUNCH.md` §5. Add to it:
  - a push alert arriving and opening the right pass;
  - the offline boarding pass with airplane mode on;
  - a password-reset email opened on the same phone;
  - the largest text size, and VoiceOver or TalkBack.
- **N1. Try everything that needs real services once the project exists.** That is:
  - sign-in and reset emails;
  - the push function and its webhook;
  - crash reports reaching Sentry;
  - the console against production data.

  None of these can be run without the accounts.

### Medium

- **N5. Two-factor sign-in for staff and admins.** Operators and platform admins
  can change the network and crew. Add authenticator-app codes (Supabase TOTP) to
  the console and the staff app, and have the database require them for admin and
  operator actions (`aal2`).
- **N6. CAPTCHA on sign-up and reset.** Rate limits slow bulk sign-ups and email
  floods; Turnstile or hCaptcha stops them. Needs a site key and the widget in the
  apps.
- **N2. Tests for the operations console.** The console has no automated tests,
  because it only runs against Supabase. Add a few Playwright tests against the
  local Supabase stack (`npm run backend:up`): sign in as an operator, schedule a
  departure, assign crew.
- **N3. Content Security Policy for the website.** Security headers are set, but
  there's no CSP. Add one once the final hosting domain and Supabase address are
  known.

### Low

- **N4. One visual style for the website.** The console keeps the earlier
  prototype's look (lime accents, Inter font from Google Fonts). Restyle it to match
  the information page and the apps when convenient. It's staff-only, so this is
  cosmetic.

## Verified in this pass

**Third pass (9 November 2026):**
- **Website:** typecheck, lint, 86 unit tests and the production build.
- **Phone apps:**
  - typecheck and lint;
  - 63 unit tests, including colour contrast for both palettes;
  - 13 end-to-end tests, including the in-app dialog and dark mode;
  - Expo Doctor 20/20.
- **Database:** all 23 migrations apply on PostgreSQL 17.11. All 118 database
  checks pass, with Supabase's default grants mirrored. Without 0023, the 9 new
  checks fail, which proves they catch the problems. The concurrency race passes.
- **By hand, in a browser:**
  - passenger: hub details, booking two seats, the pass and notifications;
  - driver: delay, start trip;
  - operations: new departure, including both clash messages;
  - the website, legal pages and console routes.
- **Dependencies:** `npm audit` finds 0 vulnerabilities in both projects.

**Second pass:**

- Website: typecheck, ESLint 10, 70 unit tests (shared rules, adapters, push
  messages), production build of the information page, console and legal pages.
  The page was checked in a browser at desktop and phone width with no sideways
  scrolling; images, legal pages and the `/console` setup screen loaded.
- Phone apps: typecheck, ESLint 10, 23 unit tests, Expo Doctor 20/20, the
  store-config check for both apps, and release exports for iOS and Android with
  no pre-launch wording.
- Accounts: 13 tests of the password, email-code and error-message rules; the
  console's idle limit; the Supabase CLI (3.0) reads `config.toml` and finds all
  five email templates (a missing template and a bad duration were each caught
  when tried on purpose).
- End-to-end: 12 Playwright tests pass. They cover:
  - ToGo: onboarding → reserve two seats → pass → check in → My trips; cancel; welcome back.
  - ToGo with a faked GPS position: the distance to the hub appears without a prompt and updates as the position moves (670 m → 3.4 km → "You're at …"); without permission, a button is shown instead.
  - ToGo's sign-in screen: common and personal passwords refused as typed, show and hide, the forgotten-password steps.
  - ToGo Staff: driver, conductor, hub attendant and operations; no booking screens in the staff app.
  - The full journey: a passenger reserves and checks in, then the conductor boards them by code.
- Each app's bundle no longer contains the other app's screens (checked in the exported bundles).
- `npm audit`: 0 vulnerabilities in both projects.

## Not verified

- **Migration 0023 on the hosted project.** It was tested on PostgreSQL 17, with
  Supabase's default grants copied into the test setup. Apply it with
  `supabase db push`. Afterwards, the Database Advisors page in the dashboard
  should show no "security definer view" or exposed-function warnings for these
  objects.
- **The new web headers in a real nginx.** The config wasn't run, since there's no
  Docker here. After deploying, check them with
  `curl -I https://YOUR-SITE/console/`. If the Supabase project uses a custom
  domain, add it to `connect-src` in `deploy/security-headers.conf`.
- **Anything against a real Supabase project**: sign-up and reset codes, the
  "password changed" email, other devices being signed out, the console's data
  screens, push delivery. No local Supabase stack was run either (no Docker here).
  The production dashboard settings must be copied by hand (BACKEND.md).
- **Physical phones.** Not tried on a device:
  - push receipt;
  - camera scanning;
  - maps, keep-awake and location sharing;
  - the passenger's own dot following them, its accuracy and battery use;
  - large text and screen readers;
  - the offline pass.
- The end-to-end tests run the React Native screens in a browser, not on iOS or
  Android. They don't cover native-only behaviour.
