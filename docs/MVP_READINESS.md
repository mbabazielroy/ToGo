# ToGo — MVP readiness

A pilot **virtual bus terminal** for the Kampala ⇄ Mbarara corridor. Passengers
reserve a seat at a pickup hub and pay the operator at boarding (no in-app payment);
staff run the trip; a dispatcher schedules and crews departures.

This document tracks **software** readiness only. It deliberately keeps software
status separate from the **external, non-software prerequisites** (Supabase
provisioning, hub authorization, operator agreements, staff training, live field
testing) that gate a real launch — those are in section D and are **not** implied by
any green item in sections A–C.

Two runtime surfaces exist and share the same platform-neutral rules
(`src/state/logic.ts`, `src/data/*`):

- **Preview (demo) mode** — seeded fictional data, on-device persistence, opt-in via
  `VITE_TOGO_DEMO=1` (web) / `EXPO_PUBLIC_TOGO_DEMO=1` (mobile). A working app with no
  backend. Everything in section A is exercised here.
- **Connected mode** — the default; real Supabase auth + shared data + secured RPCs.
  Its code paths are present and the database layer is proven against real Postgres
  locally, but the live hosted transport **cannot be runtime-verified in this
  environment** because no Supabase project is provisioned or reachable (section B).

> **Reconciliation correction (this phase).** An earlier report listed a "backend fare
> snapshot" and "crew-assignment functions" as *missing*. Inspecting the migrations
> shows that was inaccurate: `bookings.fare_ugx_snapshot` has existed since
> `0005_bookings.sql` (set from the trip fare inside `reserve_booking`), and conductor
> assignment has existed since `0013_management.sql` (`operator_assign_conductor`).
> Neither was re-added. The genuine gaps — added in `0017_staff_workspace.sql` — were
> **driver** crew assignment, a read-only **`resolve_boarding`**, a hub-incidents read,
> and self-only staff-workspace resolution. No historical migration was rewritten and
> no access control was weakened.

---

## A. Implemented and verified locally (preview mode)

Verified by automated tests and by exercising the flows through the UI in a headless
browser / the native web preview. Test counts below are current.

**Passenger (web + native)**
- Browse hubs and today/upcoming departures; reserve seats with a duplicate-click
  guard; **pay-at-boarding** with no payment processing.
- Boarding pass with QR + 4-digit code, journey timeline, self check-in, cancel.
- Correct destination/arrival (corridor city + `destinationArrival`), locked by
  `src/data/journey.test.ts`.
- **Booked fare snapshot**: a booking records `fareAtBooking`; later dispatcher fare
  edits never retroactively change a passenger's quoted fare
  (`src/state/operator.test.ts`).

**Preview experience**
- Preview opens a *working* app (not a setup screen); explicit opt-in flag; a discreet
  **Preview** indicator; connected mode + its honest setup/connection-error screens are
  intact; a configured connected app is **never** silently switched to local data.
- Web role switcher and native **Staff workspace** (Account → Staff workspace) share
  one local dataset, so a passenger reservation immediately appears in the attendant,
  conductor, and dispatcher views on the same device.
- **Preview sign-up experience** (Account → *Preview sign-up experience*, web +
  native): a faithful walkthrough of the connected sign-in / create-account / reset
  flow so the founder can inspect onboarding. It is clearly labelled local preview,
  **not** real registration: it authenticates nothing, creates no account, and never
  collects or persists a password (the field clears on submit — verified in a headless
  run). It states plainly that public sign-up yields a **passenger account only**.

**Staff personas — native Expo (`apps/mobile/app/staff/*`)**
- **Driver**: today's assigned trips; vehicle/route/departure/conductor; next pickup
  hub + time; expected / checked-in / boarded seat counts; start trip, reach hub,
  report delay, report breakdown, complete trip (destructive actions confirmed);
  location-sharing status labelled *simulated (preview)* — no background-tracking
  claims.
- **Conductor**: assigned trip + ordered stops; manifest grouped by hub with
  name/reference search; **QR scanning with explicit camera permission** and a working
  **manual boarding-code fallback**; scanning **never auto-boards** (resolve →
  explicit confirm → board); scan debounce; invalid / cancelled / wrong-trip /
  already-used handled; warn before leaving checked-in passengers behind, requiring an
  incident reason; missed-pickup outcome preserved.
- **Hub attendant**: assigned hub; upcoming buses with delays; expected + checked-in
  **seat** counts; check-in by reference; unresolved incidents.
- Preview persona selection **only filters simulated data on the device — it grants no
  backend permission** (and is not treated as proof of backend authorization).

**Dispatcher console — web preview (`src/pages/staff/Operator.tsx`)**
- Today's departures with actionable status and KPIs.
- **Create a departure** (route → direction & ordered stops, vehicle → capacity, date,
  time, journey length → arrival, fare) and **edit/cancel**.
- **Assign driver/conductor** per departure with validations: role match, operator
  match, and **overlapping-assignment** rejection (a person can't crew two overlapping
  trips).
- Per-trip **manifest**; delays; cancellation restores capacity **exactly once**;
  reserved fare totals shown as booked fares, **distinct from money collected**.

**Shared business rules** (`src/state/logic.ts`)
- Capacity / overbooking; idempotent cancel / check-in / board; single-use boarding
  codes; outcome classification at completion (`missed_pickup` vs `not_boarded`);
  unresolved-pickup recording; invalid-transition rejection.

**One complete scenario, executed through the UI (web preview)**
Dispatcher creates a departure and assigns a driver + conductor → passenger reserves 2
seats → hub attendant checks in by reference → conductor validates the boarding code
and boards → trip is completed → journey/booking records update → state **persists
across reload**. (See screenshots captured this phase: `s_web_operator`,
`s_web_ticket`, `s_web_attendant`, `s_web_conductor`, `s_web_operator_manifest`, and
the native `s_personas` / `s_driver` / `s_conductor*` / `s_attendant`.) In the native
preview the same lifecycle was verified against an existing assigned departure.

**Automated test evidence** (this phase)
- Web: `tsc -b` clean, `eslint .` clean, **44 vitest tests pass**
  (`logic.test.ts` 18, `operator.test.ts` 10, `staff.test.ts` 6,
  `demoAdapter.test.ts` 6, `journey.test.ts` 4).
- Mobile: `tsc --noEmit` clean, **4 vitest tests pass**.
- New rules covered this phase: `createTrip`/`assignStaff` validations + overlap,
  fare-snapshot preservation, staff assignments, resolve-before-board, attendant hub
  views + missed-pickup, capacity-restored-once.

---

## B. Implemented, and verified against real Postgres locally (awaiting a hosted project)

Code paths exist, typecheck/lint clean, and the database policies + functions are
proven by the RLS/authorization suite against a **real PostgreSQL** locally
(`npm run db:test` → **84/84 pass**, including the new staff cases). What still
requires a *hosted* Supabase project is the live Auth/PostgREST/Realtime transport —
**not verifiable in this environment**.

- **Connected auth & passenger flow** (web + native): email/password auth, public
  browsing signed-out, reserve via secured RPCs, My Trips, in-app notifications,
  scoped Realtime, honest pending/failed/empty/stale states, and the setup /
  connection-error screens. Public sign-up creates a **passenger profile only** —
  proven by the `handle_new_user` trigger (forces `is_platform_admin=false`, ignores
  client role metadata) and the escalation tests in the RLS suite.
- **Connected dispatcher** (`src/pages/connected/workspaces/OperatorWorkspace.tsx` +
  `src/data/management.ts`): create departure, edit/cancel trip, fleet/vehicle
  management, route creation + **ordered route-stop editor**, operator-member
  assignment — all against Supabase RPCs/tables.
- **Connected crew assignment**: conductor assignment (`operator_assign_conductor`,
  pre-existing) **and** the new driver assignment (`operator_assign_driver` /
  `operator_remove_driver`, migration 0017), both operator-scoped and RLS-tested
  (cross-operator assignment is rejected).
- **Connected staff workspaces** (`SupabaseAdapter.listStaff / staffTrips /
  attendantHubId / hubIncidents / resolveBoarding`): now backed by real,
  authority-checked functions (migration 0017 — `my_staff_workspaces`,
  `my_assigned_trip_ids`, `get_hub_incidents`, `resolve_boarding`), plus the adapter
  contract test (`src/data/supabaseAdapter.test.ts`). Each returns **only the
  authenticated user's own verified assignments**; a preview persona is never
  involved. `resolve_boarding` is read-only (`STABLE`) and **never boards** — proven
  by an RLS case asserting the booking stays `reserved` after resolve.
- **Database policies**: the RLS/authorization suite under `supabase/tests` runs on a
  running Postgres / live project (`npm run db:test`).

> These connected actions are proven against local Postgres but have **not** been
> executed against a live hosted Supabase project (Auth + PostgREST + Realtime) in
> this phase.

---

## C. Missing / not yet built (software)

- **Web dispatcher driver-assignment UI**: `management.assignDriver/removeDriver` and
  the RPCs exist, but the web `OperatorWorkspace` currently exposes a conductor picker
  only; a driver picker still needs wiring (the native/demo dispatcher already models
  both roles).
- **Real GPS / live location** and **background tracking** (native dev build only — not
  claimed in preview) and a **real map** (needs published hub coordinates + a dev
  build).
- **Native auth deep links** (email confirm / password reset) need a **development
  build** with configured Supabase redirect URLs; email/password sign-in itself works
  in Expo Go.

---

## D. External (non-software) launch prerequisites

Independent of the code and **not** implied by sections A–C:

- **Supabase project** provisioned, migrations applied, and `*_SUPABASE_URL` /
  `*_ANON_KEY` configured for web and mobile.
- **Hub site authorization** — permission to operate the physical pickup points (the
  seeded hubs are illustrative and not partnered).
- **Operator commercial agreements** for the corridor.
- **Staff onboarding / training** for the driver, conductor, and attendant apps.
- **Live end-to-end field testing** on real devices with a reachable dev server
  (Expo Go or an EAS build); no device/simulator run was possible in this environment.
- **Installable iOS/Android builds** via EAS (Expo account; Apple Developer account
  for iOS signing).

---

## How to open the app now (no backend)

- **Web preview**: from the repo root, `npm run preview:local` → open the printed
  `http://localhost:5173`. Use the top-right role switcher for Passenger / Hub
  attendant / Conductor / Dispatcher console.
- **Mobile preview**: from `apps/mobile/`, `npm run preview` (QR + URLs for Expo Go)
  or `npm run preview:web`. Open **Account → Staff workspace** for the Driver /
  Conductor / Hub-attendant personas.
- **Inspect account creation**: open **Account → Preview sign-up experience** (web or
  native) to walk through the onboarding UI safely (no real registration). The real
  connected implementation lives in `src/auth/AuthProvider.tsx` +
  `src/pages/connected/AuthScreen.tsx` (web) and `apps/mobile/src/auth/AuthProvider.tsx`
  + `apps/mobile/app/auth.tsx` + `apps/mobile/app/reset.tsx` (native); the
  passenger-only guarantee is enforced by `supabase/migrations/0002_profiles.sql`.

See `docs/MOBILE.md` for the full preview/connected details and device-testing paths.
