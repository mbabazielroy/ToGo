# ToGo — Your bus. Your stop.

**Find your hub. Meet your bus.**

ToGo is a **prototype** for a virtual bus terminal platform for Uganda, founded by
Elroy and Millie. Instead of crowding into a physical terminal, passengers pick a
nearby **pickup hub**, reserve a seat, check in when they arrive, watch their bus
approach on a schematic, and board with a confirmation code. Staff coordinate the
same bookings and pickups through connected operational views.

The first corridor is **Kampala ⇄ Mbarara**.

> ⚠️ **Demo only.** Every operator, hub, fare, schedule, payment and tracking
> update in this app is illustrative. Nothing here implies a real partnership,
> approval, booking, or pickup guarantee. No money changes hands.

## Two modes

ToGo runs in one of two modes, chosen automatically by whether Supabase is configured:

- **Demo mode** (default, no configuration): a fully-usable local prototype. State
  lives in the browser's `localStorage` and is **not shared between devices**. A
  role switcher lets you preview every view. This is the original prototype,
  unchanged.
- **Connected pilot mode** (Supabase configured): real email/password
  authentication and shared PostgreSQL data with Row Level Security and realtime.
  A booking on one device appears in the right staff views on another. Workspaces
  are shown by **verified permission** (no role switcher). On any auth/permission/
  network error the app shows the error — it never silently falls back to demo.

  See **[docs/BACKEND.md](docs/BACKEND.md)** for full setup and
  **[docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md)** for what is
  implemented, verified, and still blocked on infrastructure.

This phase turns the prototype into a backend-connected **pilot**. It does not
authorize a real transport launch, and it does not add real payments.

---

## Installation and local startup

Requirements: Node.js 18+ (developed on Node 22) and npm.

```bash
npm install      # install dependencies
npm run dev      # start the dev server (Vite) — open the printed http://localhost:5173
```

Other useful commands:

```bash
npm run build      # type-check and build the production bundle into dist/
npm run preview    # serve the production build locally
npm run test       # run the Vitest suite (demo rules + adapter parity)
npm run lint       # run ESLint
npm run typecheck  # run the TypeScript compiler with no emit
npm run db:test        # apply migrations to a local Postgres and run the RLS/txn suite
npm run db:concurrency # prove the capacity guard under two racing reservations
```

**To run the prototype (demo mode):** `npm install && npm run dev`

**To run the connected pilot:** copy `.env.example` to `.env.local`, fill in your
Supabase URL + anon key, apply `supabase/migrations`, then `npm run dev`. Full
steps in [docs/BACKEND.md](docs/BACKEND.md).

---

## Tech stack

- **React 18 + TypeScript** with **Vite**
- **Tailwind CSS** for styling (deep-green / warm-white / lime brand)
- **React Router** for navigation
- **lucide-react** icons
- **qrcode** for a genuinely scannable boarding QR code
- **Vitest** for unit tests
- No backend, API keys, auth provider, or paid services.

---

## Available demo roles

Use the **role switcher** in the top-right of the header to move between views.
This switches demo views only — it is **not** real authentication or access
control, and every role reads and writes the same underlying local state.

| Role | What it does |
| --- | --- |
| **Passenger** | Search departures, reserve a seat, view the boarding pass, check in, and watch simulated tracking. Bottom nav: Home, Hubs, My Trips, Account. |
| **Hub attendant** | Pick a hub; see expected / checked-in / boarded / awaiting passenger counts (as passenger quantities), and check people in by booking reference. |
| **Conductor** | Pick a trip; see ordered pickup stops and the manifest grouped by hub, validate boarding codes, confirm boarding, and run the trip (start, delay, reach hub, complete). Leaving a hub with checked-in-but-unboarded passengers requires a recorded reason. |
| **Operator** | Dashboard of today's departures, active buses, reserved seats, waiting passengers, delayed trips and unresolved pickups. Edit a departure's schedule/fare/capacity/status, cancel a trip with a reason, and read the activity log. |

---

## Short walkthrough

1. **Home** opens directly into the usable app (no marketing splash). Choose a
   direction (Kampala → Mbarara or the reverse), date, passenger count, and a
   **pickup hub**, then tap **Find buses**.
2. **Search results** list matching departures. Each card distinguishes the
   **origin departure time** from your **hub pickup time**, and shows the arrival
   estimate, UGX fare, seats left, and status.
3. **Book**: review your pickup and destination hubs, enter a name (phone
   optional), choose passengers, review the total, and confirm with
   **"Reserve — pay at boarding"** (no payment is collected). You get a unique
   booking reference and boarding code.
4. **Trip details / boarding pass** shows the reference, a readable boarding code,
   a **scannable QR code**, pickup & arrival times, fare, and status. Tap
   **"I'm at the hub"** to check in (simulated — no GPS is requested).
5. Switch to **Hub attendant** or **Conductor** to see your checked-in passenger
   appear as **waiting**. In the conductor view, validate the boarding code and
   **confirm boarding**.
6. Complete the trip from the conductor view; the booking moves to **Completed**
   under **My Trips**.
7. The **Operator** dashboard reflects all of this live, including an activity log.
8. Reset everything from **Account → Reset demo**.

The passenger trip screen also includes **demo tracking controls** ("Advance bus",
"Simulate delay") so you can watch the schematic and estimates update consistently
across every view.

---

## Verified scenario

The core coordinated-pickup flow is covered by automated tests in
`src/state/logic.test.ts` and was exercised end-to-end in a browser:

- Reserve two seats → available capacity decreases by two.
- Check in → both passengers appear as **waiting** to attendant and conductor
  (counts are passenger quantities, not booking counts).
- Validate the boarding code → confirm boarding → booking becomes **boarded**.
- Complete the trip → booking becomes **completed** and appears under Completed.
- Cancelling a reservation restores capacity.
- Duplicate rapid actions do not change counts twice (idempotent reserve / board /
  check-in).
- Invalid, wrong-trip, and cancelled boarding codes are rejected clearly.
- Refresh preserves the demo; **Reset demo** restores usable seed data.

---

## Data & state model

Typed models live in `src/types/index.ts`: `Hub`, `Operator`, `Vehicle`, `Route`,
`Trip` (+ ordered `TripStop`s), `Booking`, and `ActivityEvent`. Trip state is kept
separate from booking state, and **delay is tracked independently** so an en-route
trip can also be delayed.

- **Booking states:** `reserved → checked_in → boarded → completed` (with
  `cancelled` where appropriate).
- **Trip states:** `scheduled → boarding → en_route → completed` (with `cancelled`).

All mutations go through centralized, pure actions in `src/state/logic.ts`
(reservation, cancellation, check-in, boarding, trip updates, schedule edits,
tracking). Derived counts (seats reserved, seats available, waiting passengers) are
computed from those actions so every view stays consistent. `src/state/store.tsx`
wraps the logic in React context and persists to versioned `localStorage`
(`src/lib/storage.ts`), reseeding gracefully on malformed or out-of-version data.
Seed data (`src/data/seed.ts`) generates departures in both directions relative to
**today in Africa/Kampala**, so the prototype stays usable over time. Fares are
formatted in **UGX** and all times use the **Africa/Kampala** timezone.

### Assumptions recorded

- "The passenger" is the single local demo user; My Trips shows all bookings made
  in this browser (there is no login).
- Pickup-time offsets per hub, trip durations, fares and capacities are invented
  and defined in `src/data/seed.ts`.
- The destination hub shown on a booking is the central hub of the destination
  city, for illustration.
- Rapid duplicate reservations (same trip, hub, name and seat count within a few
  seconds) are treated as the same booking to guard against double-clicks.
- Seed data is regenerated (not migrated) whenever the storage version changes; the
  chosen role is preserved.

---

## Demo limitations

- Single browser only — state does **not** sync across devices or browsers.
- No real payments, login, GPS tracking, SMS/push notifications, or backend.
- Tracking is a **schematic**, not geographically precise navigation.
- Notification preferences are illustrative and never send real messages.
- Hubs are demo locations; ToGo does not guarantee pickup or imply partnerships.

---

## Future integration points

This prototype is intentionally structured so real services can slot in later:

- **Authentication** — replace the local demo profile / role switcher with a real
  identity provider and role-based access control (the role switcher is where auth
  would gate views).
- **Shared database / backend** — swap `src/lib/storage.ts` + `src/state/store.tsx`
  for an API client so bookings and trip state sync across devices in real time.
  The centralized actions in `src/state/logic.ts` map cleanly to server endpoints.
- **Live tracking** — replace the simulated `advanceBus` / progress model and the
  `RouteSchematic` with a real GPS feed and map provider.
- **Payments** — replace "Reserve — pay at boarding" with a real mobile-money /
  card flow at the confirmation step.
- **Notifications** — wire the notification preferences to a real SMS/push service.

---

_ToGo · Your bus. Your stop. · Prototype build — illustrative demo only._
