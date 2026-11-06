# ToGo — launch readiness overview

_5 November 2026 (updated) · ToGo 1.0.0 (passengers) and ToGo Staff 1.0.0 (crew + operations)_

## Verdict

**The software is ready for TestFlight and Play internal testing. It is not ready to
submit for public review yet.** What's left is mostly accounts, hosting, legal details
and real-device testing that only you can do. One policy risk needs a decision: Apple
may reject ToGo Staff as an internal-only app.

| Area | Status |
|---|---|
| App Store / Play policy requirements in the code | Done |
| Automated checks (tests, types, lint, Expo Doctor, release bundles) | Passing locally |
| CI/CD on GitHub | Added; runs after you push |
| Production backend (Supabase) | Not set up |
| Company details in the legal text | Wired up; your values not entered yet |
| Policy hosting | Not set up |
| EAS projects | Done (`@elly1/togo-mobile`, `@elly1/togo-staff`) |
| Store listing text, review notes, data-safety answers | Done (`docs/STORE_LISTING.md`) |
| Apple / Google accounts, signing credentials, `EXPO_TOKEN` | Not set up |
| Real-device test on production | Not done |

## Fixed in the second pass

| Blocker or risk | Fix |
|---|---|
| EAS projects didn't exist, so the release workflow couldn't build | Created and linked `@elly1/togo-mobile` and `@elly1/togo-staff`; ids live in `app.config.js` |
| The privacy policy and terms didn't say who runs ToGo | New "Who we are" section from `EXPO_PUBLIC_LEGAL_NAME`, `EXPO_PUBLIC_LEGAL_ADDRESS` and `EXPO_PUBLIC_SUPPORT_EMAIL` (in-app and hosted pages); store builds refuse to build without them |
| Phone lock paused the bus position mid-trip | ToGo Staff keeps the screen awake while sharing, and sharing continues across the crew tabs |
| No reminders outside the app | Local notifications: "Check-in is open" (2 h before) and "Time to head to your hub" (30 min before); tapping opens the pass; cleared on cancel, sign-out or when turned off. No server needed |
| No listing copy, review notes or screenshot plan | `docs/STORE_LISTING.md` |
| `eas.json` had a comment key EAS rejects | Removed |
| Placeholder "T" icon and logo | Your bus artwork is now the ToGo app icon (iOS, Android adaptive with gradient background, themed monochrome), the splash screen, favicon, notification icon and the in-app logo. ToGo Staff keeps its green "T" mark so crews can tell the apps apart |

## Fixed in the first pass

| Issue | Store rule | Fix |
|---|---|---|
| The passenger app asked for the camera on Android, and its iOS camera text said "ToGo Staff" | Play permissions policy; App Store 5.1.1 (purpose strings must match the app) | Each app has its own permission text; the camera is blocked in the passenger app on Android |
| The location prompt in the passenger app talked about drivers | App Store 5.1.1 | The passenger prompt now covers only the nearest-hub map, and says your location stays on your phone |
| A misconfigured release build would open on a developer "Setup needed" screen mentioning Supabase | App Store 2.1 (incomplete app) | EAS production builds now fail if they're in preview mode, have no backend, or lack a privacy URL, support email or (Android) Maps key. Release builds also never show setup text |
| No account-deletion web link | Google Play requires a deletion URL that works without the app | `/legal/delete-account.html` is generated with the privacy and terms pages from the in-app text, on every web build |
| Build numbers were local, so CI builds would reuse them and uploads would be rejected | Both stores | EAS remote versioning with auto-increment |
| Privacy policy overstated which records are kept after deletion | Accuracy of privacy disclosures | Text corrected to match the database |
| Account deletion had no database test | Apple 5.1.1(v) | New Postgres test: only the caller is deleted, audit rows survive without the person, other accounts are untouched |
| macOS `._*` files from the external drive could be committed | — | Added to `.gitignore` |

Already done in the earlier pass: in-app account deletion, privacy and terms screens,
consent at sign-up, no background location, iOS privacy manifests, export compliance,
iPhone only, staff accounts not creatable in the app, pre-launch wording removed,
separate icons and splash screens, check-in window.

## CI/CD

- **`ci.yml`** (every push and PR):
  - Web and shared code: typecheck, lint, 66 tests, build, and a check that the legal pages exist.
  - Mobile: typecheck, lint, tests, Expo Doctor, a store-config check of both apps (iPad off, export compliance, privacy manifest, background location blocked, no camera in the passenger app), an iOS + Android release export of both apps, and a scan for pre-launch wording.
  - Database: Postgres RLS, transaction and concurrency suites (now including account deletion).
- **`eas-release.yml`**: manual run (choose the app, platform, preview or production, and whether to submit) or a `v1.0.0` tag. It reruns the checks, then queues EAS builds and, optionally, auto-submits to TestFlight and Play internal testing (draft).
- **`dependabot.yml`**: monthly GitHub Actions updates.

## Verified

- Root: typecheck, lint, 66/66 tests, web build that produces `dist/legal/*.html`.
- Mobile: typecheck, lint (0 problems), 10/10 tests (including the new reminder planner), Expo Doctor 20/20.
- CI store-config check and release export run locally for both apps on iOS and Android; no pre-launch wording found.
- Release guard: a production build with demo mode and no backend fails with a clear list. A correctly configured staff build resolves with the staff permission text. The passenger build has no camera permission.
- Both workflow files parse as valid YAML.
- Browser preview: new logo on welcome, sign-in and headers; "Who we are" in the privacy policy; Alerts settings; no console errors.
- Both EAS projects resolve (`eas project:info`).

**Not verified:** the workflows haven't run on GitHub (nothing is pushed). The new
database test hasn't run (no Postgres on this Mac; CI runs it). Connected mode against
a real Supabase project hasn't been tested. No physical device has been tested.

## Blockers before store review (you)

1. **Company details:** set `EXPO_PUBLIC_LEGAL_NAME`, `EXPO_PUBLIC_LEGAL_ADDRESS` and `EXPO_PUBLIC_SUPPORT_EMAIL` in EAS (production) and on the web host. Have the policy and terms reviewed against Uganda's Data Protection and Privacy Act 2019.
2. **Hosting** (excluded from this pass): deploy the web app so the `/legal/*` pages are live.
3. **Supabase production** (excluded): project, migrations, redirect URLs, and the EAS variables.
4. **Apple and Google accounts** (excluded): then add the App Store Connect API key and the Play service-account key with `eas credentials`, and upload the first Android build by hand.
5. **`EXPO_TOKEN`:** create it at expo.dev → Access tokens and add it as a GitHub Actions secret.
6. **Reviewer accounts and screenshots:** these need the production backend; the steps and sizes are in `docs/STORE_LISTING.md`.
7. **Device test:** `docs/STORE_LAUNCH.md` §5 on a real iPhone and Android phone. This Mac has no Xcode, so the iOS Simulator wasn't available.

## Risks and decisions

- **ToGo Staff and Apple 3.2:** an app only staff can sign in to is often rejected as internal-only. Recommended: distribute it privately (Apple Business Manager / Unlisted, and Managed Google Play) and send only ToGo for public review.
- **Location while the app is open:** the screen now stays awake, but if a driver closes or backgrounds the app, the bus stops updating. Background location would need a strong justification to pass review.
- **Delay alerts are in-app only:** trip reminders now arrive as phone notifications, but delays and changes need push (a server-side sender). Add it next.
- **Google Play closed testing:** new personal developer accounts must run a closed test (12+ testers for 14 days) before production access. Plan for that time.

## Suggested launch order

1. Push the branch and let CI go green.
2. Finish blockers 1–5.
3. Run a `preview` build from the release workflow and test on phones.
4. Run a `production` build with submit to TestFlight and Play internal testing; do the device test (blocker 7).
5. Run the Play closed test; meanwhile submit ToGo to App Review.
6. Distribute ToGo Staff privately to crews.
