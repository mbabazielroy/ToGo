# ToGo — implementation status (backend-connected pilot phase)

_Snapshot for the phase that turns the prototype into a backend-connected pilot._
This does **not** authorize a real transport launch. All operators, hubs, fares,
schedules, tracking, and "approvals" are illustrative.

## 1. What was implemented

**Architecture**
- Clean data-access layer (`src/data/adapter.ts`) with two implementations:
  - `DemoAdapter` — the existing local state + rules (`src/data/demoAdapter.ts`).
  - `SupabaseAdapter` — the shared backend (`src/data/supabaseAdapter.ts`).
- Mode detection (`src/lib/env.ts`): demo when unconfigured, connected when the
  public Supabase URL + anon key are present. **No silent fallback** to demo on
  auth/permission/network errors. Service-role keys are refused in the client.
- The original demo app is untouched and remains the default experience.

**Database & migrations** (`supabase/migrations/0001–0010`)
- Tables: profiles, operators, operator_members, hubs, hub_staff, vehicles,
  routes, route_stops, trips, trip_stops, trip_staff, bookings, booking_events,
  location_updates, notifications, incidents — with FKs, indexes, checks, and
  timestamps. Money is integer UGX; instants are `timestamptz`.
- Bookings **snapshot** fare and pickup/dropoff stops + times, so later schedule or
  price edits never change what a passenger booked.
- Passenger-visible vs internal hub data separated; only approved, active,
  non-demo hubs are bookable (via `hubs_public` / `trips_public` /
  `trip_stops_public` column-safe views).

**Auth & permissions**
- Email/password signup, login, logout, email-confirmation handling, and password
  reset with loading/error states (`src/auth`, `src/pages/connected/AuthScreen.tsx`).
- Public signup creates a **passenger only**; users cannot promote themselves or
  edit their own privileged assignments (trigger + RLS).
- Roles: passenger, operator staff, hub attendant, conductor, platform admin (a
  user may hold several staff assignments). Enforced by **RLS policies + secured
  functions**, not hidden UI. The role switcher exists **only in demo mode**;
  connected mode shows workspaces from verified permissions.

**Transactional booking & boarding** (`0009_functions.sql`)
- Secured `SECURITY DEFINER` functions (fixed `search_path`, restricted grants,
  explicit caller/assignment checks) for reserve, cancel, check-in, board, trip
  status, cancel trip, unresolved pickups, schedule edits, location, notifications,
  and minimal-PII manifests.
- Atomic reserve validates auth, trip status + cutoff, active ordered stops,
  quantity, capacity (row-locked), and current fare. Whole-trip capacity;
  intermediate-stop resale deferred. Idempotency keys; conflicting reuse fails.
  Opaque boarding credentials; duplicate/invalid-state boarding rejected.
- Append-only audit (`booking_events`) — no client update/delete.

**Connected flows** (`src/pages/connected/**`)
- Passenger workspace: search bookable trips, reserve (idempotent, double-submit
  guarded), My Trips with realtime, boarding pass (opaque-credential QR), check-in,
  cancel, notifications, and location **freshness** (never an invented position).
- Staff workspaces: hub attendant (expected/check-in), conductor (manifest, board
  by credential, lifecycle, unresolved-pickup guard, foreground location sharing),
  operator (their departures, edit with capacity floor, cancel), admin (hub
  approvals, staff assignment).
- Loading / empty / permission-denied / retry states; honest pending/failed
  status; nothing shown as confirmed before the server accepts it.

**Location, notifications, incidents**
- Foreground staff location sharing with explicit start/stop, permission-on-demand,
  status (active/denied/unavailable/interrupted), throttling, coordinate
  validation, observed+received times, and assignment-checked writes. Passengers
  see last-update time and a stale flag. Simulated tracking stays demo-only.
- Persistent in-app notifications generated from trusted mutations (booking
  confirmed, schedule change, delay, trip cancelled) with dedupe keys.
- Incident records (breakdown / missed pickup / left-unboarded / hub unavailable)
  with private staff notes and a passenger-facing service message.

**Config & delivery**
- `.env.example`, `supabase/config.toml`, `supabase/seed.sql` (clearly test data),
  `docs/BACKEND.md` (setup, redirects, admin bootstrap), this status doc, and
  `npm run db:test` / `db:concurrency`.

## 2. What was verified

Run in this environment against a **real PostgreSQL 16**:

- **RLS + transaction suite — 37/37 passing** (`npm run db:test`). Covers: reserve
  + fare snapshot, overbooking limits, cancellation restoring capacity once,
  idempotent replay + conflicting-key failure, cross-passenger booking isolation,
  internal-hub hiding, attendant scope, boarding validation (unknown / wrong-trip /
  cancelled / double-board), cross-operator access denial, self-promotion &
  self-assignment blocks, unauthorized location writes + throttling + coordinate
  validation, invalid trip transitions, and capacity-floor edits.
- **Concurrency — passing** (`npm run db:concurrency`): two overlapping
  transactions race for the last seat; exactly one wins, the other gets `SOLD_OUT`.
- **Frontend adapter parity — 6/6** and **demo logic — 17/17** (`npm test`, 23 total).
- **Build, typecheck, lint** all pass.
- **Demo mode** still renders and books end-to-end in a headless browser with zero
  page errors; **connected mode** renders its auth screen with zero page errors.

## 3. What remains blocked (needs infrastructure)

- **No Supabase project/credentials** were available, so the **Supabase JS
  adapter's live round-trip** (GoTrue auth + PostgREST + Realtime) is
  **not runtime-verified**. The RLS/transaction logic it calls **is** verified at
  the database level; the client mapping is typechecked and builds.
- Cross-device passenger→staff realtime and the two-authenticated-context browser
  flow require a running backend (GoTrue/PostgREST/Realtime), which the local raw
  Postgres does not provide.
- Email delivery (confirmations/reset) requires Supabase Auth SMTP/Inbucket.

## 4. Smallest next configuration step

Create a Supabase project and set two values in `.env.local`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-anon-key>
```

Then apply migrations (`supabase db push` or paste `0001–0010` in the SQL editor)
and, optionally, `supabase/seed.sql`. Sign up one user and promote them to admin
per `docs/BACKEND.md §5`. That single step flips the app into connected mode and
enables end-to-end verification against the already-proven schema.
