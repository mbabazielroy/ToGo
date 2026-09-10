# ToGo backend (Supabase) — setup & operations

This document covers standing up the connected-mode backend, configuring auth
redirects, seeding local data, and the administrator bootstrap. It is written so
someone **without a working laptop for the app itself** can still provision the
backend from the Supabase dashboard and a SQL console.

> Nothing here launches a real transport service. Hubs, operators, fares, and
> schedules are illustrative. "Approved" hub status is a platform decision inside
> this demo — it does not represent a real-world approval or partnership.

---

## 1. Modes

- **Demo mode** (default): no environment variables set. The app runs entirely in
  the browser with local seed data. Fully usable, clearly labelled "Demo mode".
- **Connected mode**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. The
  app uses real Supabase auth and shared data. On any auth/permission/network
  error it shows the error — it never silently falls back to demo.

Only the **public URL** and **publishable/anon key** are used in the frontend.
The service-role key must never appear in a `VITE_` variable.

---

## 2. Provision a Supabase project

1. Create a project at https://supabase.com (free tier is fine for a pilot).
2. In **Project Settings → API**, copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / publishable key** → `VITE_SUPABASE_ANON_KEY`
3. Locally, copy `.env.example` to `.env.local` and paste those two values.

---

## 3. Apply migrations

The schema lives in `supabase/migrations/*.sql`, applied in filename order.

### Option A — Supabase CLI (recommended)
```bash
# install the CLI: https://supabase.com/docs/guides/cli
supabase link --project-ref <your-project-ref>
supabase db push          # applies supabase/migrations in order
# optional local dev stack (Postgres + Auth + Studio + Inbucket):
supabase start
supabase db reset         # re-applies migrations + supabase/seed.sql locally
```

### Option B — SQL editor
Paste each file in `supabase/migrations/` **in numeric order** (0001 → 0010) into
the Supabase SQL editor and run them. Do **not** run `supabase/tests/00_shim.sql`
against a real project — Supabase already provides the `auth` schema and roles.

Then optionally run `supabase/seed.sql` for illustrative departures.

---

## 4. Configure auth redirects

In **Authentication → URL Configuration**:
- **Site URL**: your app origin (e.g. `http://localhost:5173` for local, or your
  deployed URL).
- **Redirect URLs**: add every origin the app is served from. Email confirmation
  and password-reset links redirect back to `‹origin›/`.

Email/password is the only method used. For a pilot you may disable email
confirmations (Authentication → Providers → Email) so testers can sign in
immediately; the app handles both the confirmation-required and instant-session
cases.

---

## 5. Administrator bootstrap (trusted, documented, not public)

There is **no** hard-coded admin and **no** public promotion endpoint. Users can
never promote themselves — the `profiles.is_platform_admin` column is protected by
a trigger and by RLS. Bootstrapping the first admin is a trusted server action:

1. Have the person **sign up** in the app (creates a passenger `profiles` row).
2. Find their user id in **Authentication → Users** (or `select id, email from
   auth.users;`).
3. In the SQL editor (which runs as a privileged role with no end-user JWT), run:
   ```sql
   update public.profiles set is_platform_admin = true
   where id = '<that-user-uuid>';
   ```
   The guard trigger allows this because there is no authenticated end-user in a
   SQL-console/service context (`auth.uid()` is null). An ordinary signed-in user
   running the same statement is rejected.

After that, the admin can assign all other staff from the in-app **Admin**
workspace (or via SQL): operator memberships, hub attendants, and trip conductors.

---

## 6. Roles & permissions (enforced in the database)

| Role | Granted by | Can see / do |
| --- | --- | --- |
| Passenger | public signup | Own bookings & notifications; browse bookable hubs/trips; reserve/cancel/check-in via secured functions. |
| Operator staff | admin (`operator_members`) | Their operator's trips, vehicles, routes; edit schedule/fare/capacity; cancel trips. |
| Hub attendant | admin (`hub_staff`) | Expected/checked-in passengers at their hubs (minimal PII, via RPC); check-in by reference. |
| Conductor | operator/admin (`trip_staff`) | Assigned trips: manifest (via RPC), validate boarding credentials, run trip lifecycle, share foreground location. |
| Platform admin | trusted bootstrap | Platform configuration and all staff assignments; hub approvals. |

Permissions are enforced by **RLS policies** and **SECURITY DEFINER functions with
explicit caller checks** — not by hidden UI. Passenger browsing uses column-safe
views (`hubs_public`, `trips_public`, `trip_stops_public`) that never expose
passenger lists, contact details, boarding credentials, or incidents.

---

## 7. Authoritative mutations (secured functions)

All booking/trip mutations run inside `SECURITY DEFINER` functions with a fixed
`search_path`, restricted `EXECUTE` grants, and explicit identity/assignment
checks (see `supabase/migrations/0009_functions.sql`):

`reserve_booking`, `cancel_booking`, `check_in_booking`, `check_in_by_reference`,
`board_booking`, `update_trip_status`, `report_delay`, `reach_hub`, `cancel_trip`,
`record_unresolved_pickup`, `operator_update_trip`, `deactivate_trip_stop`,
`report_location`, `mark_notification_read`, `get_trip_manifest`, `get_hub_expected`.

Highlights:
- Reservations lock the trip row (`FOR UPDATE`) so concurrent bookings can't
  overbook. Conservative **whole-trip capacity**: every active reservation consumes
  a seat for the whole trip. *Seat resale between intermediate stops is deferred.*
- **Idempotency keys** make retries safe; reusing a key with different parameters
  fails with `IDEMPOTENCY_CONFLICT`.
- Boarding credentials are opaque high-entropy tokens (no PII) validated only by
  assigned trip staff; double-boarding and wrong-trip codes are rejected.
- `booking_events` is an append-only audit log — clients have no update/delete
  grant; only definer functions write it.

---

## 8. Realtime

The `supabase_realtime` publication includes `trips`, `bookings`, `notifications`,
`location_updates`, `booking_events`, and `incidents`. The app subscribes with
scoped channels and refetches authoritative state after changes/reconnects. RLS
still filters every realtime row, so subscribers only receive what they may read.

---

## 9. Running the database tests

The policy/transaction tests run against a real Postgres (they prove RLS, not
mocks). With a local Postgres available:

```bash
npm run db:test         # applies shim + migrations, runs 37 RLS/transaction checks
npm run db:concurrency  # two overlapping reservations race for the last seat
```

`supabase/tests/00_shim.sql` emulates the Supabase `auth` schema/roles so the same
migrations can be exercised on a plain Postgres. Against a real Supabase project,
use pgTAP or the SQL editor with `set role authenticated` + a JWT claims GUC.
