# ToGo · Your bus. Your stop.

ToGo lets passengers reserve a seat on an intercity bus, meet it at a pickup hub
near them, and board with one scan. Crews run the same trips from a companion app.
The first corridor is **Kampala ⇄ Mbarara**.

## What's in this repository

| Part | Where | What it is |
| --- | --- | --- |
| **ToGo** (passenger app) | [`apps/mobile`](apps/mobile) | iOS and Android app: search departures, reserve, boarding pass (works offline), check in, trip reminders and push alerts. |
| **ToGo Staff** (crew app) | [`apps/mobile`](apps/mobile) | The same Expo project built as a second app: drivers, conductors, hub attendants and operations. |
| **Website** | repo root ([`src/site`](src/site), [`index.html`](index.html)) | Public information page about the app, plus the privacy, terms and account-deletion pages the app stores link to. |
| **Operations console** | [`src/console`](src/console), served at `/console` | Staff-only web tool for operators and administrators: operators, hubs, fleet, routes, departures, crew assignment, staff access and incidents. Not linked from the public page. |
| **Shared rules** | [`src/data`](src/data), [`src/state`](src/state), [`src/lib`](src/lib), [`src/types`](src/types) | Booking and trip rules, data access and seed data, used by the apps (via `@shared/*`) and the console. |
| **Backend** | [`supabase`](supabase) | Postgres schema with row-level security, functions, tests, and the push-alert server function. |

## Common commands

Requirements: Node.js 22.13 or newer, and npm.

Website and shared rules (repo root):

```bash
npm install
npm run dev          # info page at http://localhost:5173, console at /console
npm run build        # legal pages + typecheck + production build into dist/
npm test             # unit tests (shared rules, adapters, push messages)
npm run lint         # ESLint
npm run db:test      # database security and transaction tests (needs Postgres)
```

Phone apps (`apps/mobile`):

```bash
npm install
npm run preview          # ToGo in preview mode (sample data, no backend) in Expo Go
npm run preview:staff    # ToGo Staff in preview mode
npm test                 # unit tests
npm run e2e:build && npm run e2e   # end-to-end tests of the real screens (Playwright)
```

## Documentation

- [docs/MOBILE.md](docs/MOBILE.md): running and building the apps.
- [docs/BACKEND.md](docs/BACKEND.md): Supabase setup, security model and push alerts.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): deploying the backend, website and apps.
- [docs/STORE_LAUNCH.md](docs/STORE_LAUNCH.md) and [docs/STORE_LISTING.md](docs/STORE_LISTING.md): App Store and Google Play submission.
- [docs/LAUNCH_READINESS.md](docs/LAUNCH_READINESS.md): what's ready and what's left.
- [docs/AUDIT.md](docs/AUDIT.md): the latest audit of the apps and website.
