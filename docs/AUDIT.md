# ToGo app audit

_6 November 2026 · ToGo 1.0.0 and ToGo Staff 1.0.0 · branch `claude/togo-bus-terminal-0o4g26`_

## Summary

The apps are in good shape for a first release. Store requirements are met, the
database rules are tested against real Postgres in CI, and there are no committed
secrets or high-severity dependency problems. The biggest gaps are about the real
world rather than the code. A boarding pass needs a network connection to open. The
sign-in links need hardening before real accounts exist. And nothing has been tested
on a physical phone yet.

| Area | Rating | Notes |
|---|---|---|
| App Store / Play policy | Good | Done in earlier passes; see `docs/STORE_LAUNCH.md` |
| Security | Good, one fix to make | Server rules tested in CI; sign-in links accept tokens from any link (see H2) |
| Privacy | Good | No tracking or ads; sign-out now clears personal details; in-app deletion |
| Reliability | Fair | Error screens and retries exist; no offline boarding pass (H1); no crash reporting (H3) |
| Accessibility | Good, needs a device check | Buttons labelled; large-text and screen-reader passes still to do on a phone |
| Performance | Good | About 5 MB JavaScript bundle per app; images trimmed in this pass |
| Code health | Good | Typecheck and lint clean, 76 unit tests plus the database suites, CI on every push |

## Fixed in this audit

| Finding | Fix |
|---|---|
| A screen that crashed while drawing would leave a blank or red screen | App-wide error screen with **Try again**; technical detail only in development builds (`app/_layout.tsx`) |
| Six small buttons weren't announced as buttons to VoiceOver or TalkBack: the sign-in tabs, "Forgot your password?", "Back to sign in", "Back" and "Mark all read" on Notifications, and "Clear search" | Added roles, selected state for the tabs, and larger tap areas |
| Password reset accepted 6 characters while sign-up requires 8 | Both require 8; the reset field offers the phone's password suggestion |
| Raw database text, such as a constraint message, could be shown to users | Uncoded server errors now show "Something went wrong. Please try again." outside development. Coded messages, sign-in messages and network messages are unchanged |
| The in-app logo (370 KB) and splash images (1.2 MB) were heavier than needed | Logo at 384 px, splash at 640 px: about 1 MB less in ToGo and 0.7 MB less in ToGo Staff |

## Recommended next

### High priority (before or right after launch)

- ~~**H1. Boarding pass offline.**~~ **Done:** upcoming passes are saved on the phone (`src/lib/savedPasses.ts`, `src/lib/passStore.ts`) and shown, marked as saved, on the boarding pass, on My trips and on the no-connection screen. Original finding: In connected mode the boarding pass loads from the server each time. Hubs on the corridor can have weak signal, and a passenger who can't open their pass at the door is the worst failure this app can have. Fix: keep the latest copy of each upcoming booking on the phone and show it, marked "saved", when offline.
- ~~**H2. Harden the sign-in links.**~~ **Done:** the phone app and website use Supabase's PKCE flow; the phone accepts only `?code=` links (`src/auth/authLink.ts`), and token links are ignored. Still to test on a device with a real project. Original finding: The email-link handler accepts a session token from any incoming `togo://` link. A crafted link could sign someone into another person's account (login CSRF). Fix: switch Supabase to the PKCE flow and accept only `?code=` links, which only work on the phone that asked for them. Test on a device, because email links don't work in Expo Go.
- ~~**H3. Crash reporting.**~~ **Done (needs your Sentry account):** Sentry is built in and turns on in release builds that set `EXPO_PUBLIC_SENTRY_DSN`. Reports are stripped of personal data first (`src/lib/scrub.ts`); the privacy policy and store answers cover it. Original finding: Nothing reports crashes from real phones today. Add a crash reporter such as Sentry with personal data stripped, and mention it in the privacy policy and the store privacy answers.
- **H4. Device testing.** Run the checklist in `docs/STORE_LAUNCH.md` §5 on an iPhone and an Android phone. Include the largest text size and VoiceOver/TalkBack, which a browser can't check.

### Medium

- **M1. Delay alerts by push.** Trip reminders are local notifications; delays and changes only show inside the app. Add push for those (server sender plus device tokens).
- **M2. End-to-end tests.** Unit and database tests are strong, but no test drives the real screens. Add a few phone UI tests (for example with Maestro) for onboarding → reserve → boarding pass, and driver → conductor.
- **M3. Website routing library.** The web app uses `react-router-dom` 6.30.6, which has moderate advisories (open redirect, SSR deserialization). No 6.x release fixes them, so the fix is moving to version 7. This only affects the website, not the phone apps.
- **M4. Separate code per app.** The passenger app still includes the crew and operations screens in its bundle. They're unreachable and the server enforces access, but splitting them out makes the app smaller and avoids shipping staff tools to the public.

### Low

- **L1. Build-tool advisories.** `glob` and `minimatch` inside the Expo command-line tools have moderate advisories. They aren't part of the installed apps; pick up the fix with the next Expo patch (`npx expo install --fix`).
- **L2. Silent failures.** 21 places deliberately ignore an error (reminders, haptics, best-effort profile sync). That's fine today; once H3 is in, report them there instead of discarding them.
- **L3. Lint configuration.** ESLint warns that the configuration format is old. Move to the flat config when convenient.

## Verified

- CI on GitHub passes on every push: web, mobile, and the database RLS, transaction and concurrency suites. The suites cover the 2-hour check-in window and account deletion.
- Locally: 66 shared and 10 mobile tests, typecheck and lint clean, Expo Doctor 20/20, the store-config check, and release builds of both apps for iOS and Android with no pre-launch wording.
- No secrets or keys in the repository; only the `.env.example` templates.
- Browser preview: passenger and staff apps separated; crew links don't open in the passenger app; welcome, onboarding, booking, account, legal pages, and the new icons and logos.

## Not verified

- Anything against a real Supabase project, including sign-in links and password reset.
- Physical phones: notifications, keep-awake, camera scanning, maps, large text and screen readers.
- The new crash screen. It's built on Expo Router's standard error-boundary hook, but no screen was made to crash on purpose.
