# ToGo — launch readiness overview

_5 November 2026 · ToGo 1.0.0 (passengers) and ToGo Staff 1.0.0 (crew + operations)_

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
| Legal entity, policy hosting, support email | Not set up |
| Store accounts, EAS projects, signing credentials | Not set up |
| Real-device test on production | Not done |

## Fixed in this pass

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
- Mobile: typecheck, lint (0 problems), 7/7 tests, Expo Doctor 20/20.
- CI store-config check and release export run locally for both apps on iOS and Android; no pre-launch wording found.
- Release guard: a production build with demo mode and no backend fails with a clear list. A correctly configured staff build resolves with the staff permission text. The passenger build has no camera permission.
- Both workflow files parse as valid YAML.

**Not verified:** the workflows haven't run on GitHub (nothing is pushed). The new
database test hasn't run (no Postgres on this Mac; CI runs it). Connected mode against
a real Supabase project hasn't been tested. No physical device has been tested.

## Blockers before store review (you)

1. **Legal:** add the operating company's name, address and support email to `apps/mobile/src/legal/content.ts`. Have both documents reviewed against Uganda's Data Protection and Privacy Act 2019, and register with the PDPO if required.
2. **Hosting:** deploy the web app with `EXPO_PUBLIC_SUPPORT_EMAIL` set. Use `/legal/privacy.html` as the store privacy URL and `/legal/delete-account.html` as Play's deletion URL.
3. **Supabase production:** create the project, apply all migrations (including 0018 and 0019), set the auth redirect URLs `togo://` and `togostaff://`, and create the EAS environment variables.
4. **Accounts:** Apple Developer ($99/yr) and Google Play Console ($25); create both apps under their bundle IDs.
5. **EAS:** create the `togo-mobile` and `togo-staff` projects and paste their IDs into `apps/mobile/app.config.js`. Add the `EXPO_TOKEN` GitHub secret, and add the App Store Connect API key and Play service-account key with `eas credentials`. Upload the first Android build of each app by hand.
6. **Reviewer accounts:** create a passenger account and a staff account on production, with trips scheduled during review.
7. **Device test:** run the checklist in `docs/STORE_LAUNCH.md` §5 on a real iPhone and Android phone.

## Risks and decisions

- **ToGo Staff and Apple 3.2:** an app only staff can sign in to is often rejected as internal-only. Recommended: distribute it privately (Apple Business Manager / Unlisted, and Managed Google Play) and send only ToGo for public review.
- **Location only while the screen is open:** if a driver locks the phone, the bus stops updating. That's acceptable for the MVP, and the app says so. Background location would need a strong justification to pass review.
- **No push notifications:** alerts are in-app only, so passengers may miss delay messages. Add push next.
- **Google Play closed testing:** new personal developer accounts must run a closed test (12+ testers for 14 days) before production access. Plan for that time.

## Suggested launch order

1. Push the branch and let CI go green.
2. Finish blockers 1–5.
3. Run a `preview` build from the release workflow and test on phones.
4. Run a `production` build with submit to TestFlight and Play internal testing; do the device test (blocker 7).
5. Run the Play closed test; meanwhile submit ToGo to App Review.
6. Distribute ToGo Staff privately to crews.
