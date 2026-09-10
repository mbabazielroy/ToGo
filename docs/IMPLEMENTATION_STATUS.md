# ToGo — implementation status matrix

Backend-connected pilot. **Not** a real transport launch — all operators, hubs,
fares, schedules, tracking and "approvals" are illustrative.

## Legend / verification tiers

- ✅ **DB-verified** — exercised against a real PostgreSQL 16 via `npm run db:test`
  (64 RLS/transaction checks) and `npm run db:concurrency`. This is the actual
  database policy/transaction behaviour, not a mock.
- 🟦 **FE-verified** — TypeScript typecheck + ESLint + production build + headless
  browser render/route smoke. Confirms the code compiles and screens render; does
  **not** exercise the live Supabase stack.
- 🟨 **Not runtime-verified** — implemented, but the live path through Supabase
  **Auth (GoTrue) / PostgREST / Realtime** was not executed (no Supabase project
  available in this environment). A gated, self-skipping integration suite exists
  (`npm run test:integration`).
- ⛔ **Blocked** — needs infrastructure not available here.

> Important distinction: **DB-verified ≠ through-Supabase-verified.** The RLS and
> RPC logic is proven at the database level with a local auth shim that emulates
> `auth.uid()`/roles. The GoTrue login, PostgREST RPC marshalling, and Realtime
> delivery on top of it are **not** executed here.

---

## §2 Privileged profile changes (security)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Anonymous cannot change privileged fields | ✅ DB-verified | `sec: anon did not gain admin`; RLS blocks `anon` UPDATE + hardened trigger |
| Authenticated users cannot self-promote | ✅ DB-verified | `sec: authenticated non-admin cannot self-promote (trigger)`, `…via RPC` |
| User metadata cannot confer privileges | ✅ DB-verified | `handle_new_user` hard-codes `is_platform_admin=false`; signup path |
| Missing-claims caller cannot escalate | ✅ DB-verified | `sec: missing-claims cannot self-promote via RPC` |
| Bootstrap requires a trusted DB/server context | ✅ DB-verified | `sec: bootstrap via trusted role succeeds` (service_role, no JWT); hardened `profiles_guard` uses JWT identity **and** `current_user` role, not "no JWT ⇒ trusted" |
| Public functions cannot bypass this | ✅ DB-verified | No client-executable definer touches `is_platform_admin`; `admin_set_platform_admin` checks caller is admin |
| Views/grants/manifest don't leak PII/credentials | ✅ DB-verified | `exposure: public views expose no credentials/contacts/internal notes`, `exposure: manifest exposes no credential/phone` |

The earlier "auth.uid() is null ⇒ trusted" logic was the reported gap; it is
replaced (migration `0011`) with a rule documented in the migration: an
authenticated JWT identity must be an admin (this also covers a definer invoked by
a user, since the JWT persists into definers), and a *missing* identity is trusted
only when `current_user` is not one of the PostgREST end-user roles
(`anon`/`authenticated`).

## §3 Connected operational management

| Requirement | Status | Evidence |
| --- | --- | --- |
| Operator create/edit | ✅ DB-verified · 🟦 FE | `admin_create_operator/update_operator`; Admin console |
| Hub create/edit/activate/approve (internal record) | ✅ DB-verified · 🟦 FE | `admin_*_hub`, `admin_set_hub_approval` sets `approved_by/at`; Admin console |
| Vehicle create/edit/capacity | ✅ DB-verified · 🟦 FE | `operator_*_vehicle`; Operator → Fleet |
| Routes + ordered stops (approved hubs only) | ✅ DB-verified · 🟦 FE | `operator_create_route`, `operator_set_route_stops` (`mgmt: route rejects unapproved hub`); Operator → Routes |
| Departure creation & scheduling | ✅ DB-verified · 🟦 FE | `operator_create_departure` (`mgmt: operator created a departure with stops`, pickup-times mismatch guard); Operator → Departures |
| Conductor & attendant assignments | ✅ DB-verified · 🟦 FE | `operator_assign_conductor`, `admin_assign_hub_staff`; Operator → Team / Admin |
| Trip delays & cancellations | ✅ DB-verified · 🟦 FE | `report_delay`, `cancel_trip`; Operator → Departures |
| Incident report/resolve + private notes | ✅ DB-verified · 🟦 FE | `report_incident`/`resolve_incident` (`incident: …`), staff_notes never passenger-visible; Operator → Incidents |
| Operator can't approve own hubs / self-promote | ✅ DB-verified | `mgmt: operator cannot approve a hub`, `…cannot assign hub staff`, `…cannot create an operator`, `escalation: …` |
| Booked trips protected from destructive edits | ✅ DB-verified | capacity floor (`mgmt/capacity: cannot drop below active`), `deactivate_trip_stop` blocks stops with bookings, schedule edit notifies |

## §4 Connected passenger experience

| Requirement | Status | Evidence |
| --- | --- | --- |
| Direction/date/passenger/hub search | 🟦 FE-verified · 🟨 | `PassengerHome` |
| Origin departure vs hub pickup times | 🟦 FE-verified | search cards show both |
| Booking review & fare breakdown | 🟦 FE-verified | `BookPage` |
| Boarding pass + functional QR credential | 🟦 FE-verified | `TripDetailPage`, opaque `TOGO:<credential>` QR |
| Check-in & waiting instructions | 🟨 Not runtime-verified | `check_in_booking` RPC wired; UI present |
| Upcoming / completed / cancelled / no-show trips | 🟦 FE-verified | `PassengerHome` list + status pills incl. "Not boarded" |
| In-app notifications + read/unread | 🟨 Not runtime-verified | `NotificationsPage`, `mark_notification_read` |
| Account + password recovery | 🟦 FE-verified (render) · 🟨 (live email) | `AccountPage`, `ResetPasswordPage` |
| Proper routes (refresh/back/deep-link) | 🟦 FE-verified | react-router routes; deep-link + reset-route smoke passed |
| Mobile layout, large targets, error/retry states | 🟦 FE-verified | shared `useAsync`, `ErrorRow`, bottom nav |

## §5 Authentication edge cases

| Requirement | Status | Evidence |
| --- | --- | --- |
| Email confirmation callback | 🟨 Not runtime-verified | `detectSessionInUrl` + `onAuthStateChange` |
| Password recovery callback + new-password form | 🟦 FE (render) · 🟨 (live) | `PASSWORD_RECOVERY` → `recoveryMode` → `ResetPasswordPage` |
| Expired/invalid links | 🟦 FE-verified | reset page shows "invalid or expired" when no session |
| Session restoration after refresh | 🟨 Not runtime-verified | `getSession` on load |
| Expired-session handling mid-action | 🟨 Not runtime-verified | adapter surfaces errors; `onAuthStateChange` clears state |
| Logout clears private data + subscriptions | 🟦 FE-verified | `signOut` resets state; route unmount cleans channel subscriptions |
| Safe redirect handling | 🟦 FE-verified | redirects pinned to `window.location.origin` |
| Email delivery tested | ⛔ Blocked | requires Supabase Auth SMTP/Inbucket — **not tested** |

## §6 Notifications & pickup exceptions

| Requirement | Status | Evidence |
| --- | --- | --- |
| Trusted actions create deduped notifications | ✅ DB-verified | `_notify` with `dedupe_key`; `reserve/delay/cancel/no_show` paths |
| Accessible notification inbox | 🟦 FE-verified | `NotificationsPage` |
| Warn before leaving checked-in passengers | 🟦 FE-verified | Conductor depart modal |
| Require a reason for override | ✅ DB-verified | `record_unresolved_pickup` records reason + incident |
| Record incident + responsible staff | ✅ DB-verified | incident `reporter_id`, booking_events actor |
| Unresolved visible to ops staff | ✅ DB-verified · 🟦 FE | incidents RLS to operator/admin; Operator → Incidents |
| Resolution with audit trail | ✅ DB-verified | `resolve_incident`, `resolved_at`; append-only `booking_events` |
| Unboarded-at-completion handled explicitly | ✅ DB-verified | `no_show` state (not "completed"); `noshow: …` tests |
| Private notes vs passenger message separated | ✅ DB-verified | `staff_notes` never in passenger-visible policy/notification |

## §7 Supabase compatibility

| Item | Status | Notes |
| --- | --- | --- |
| Auth schema / user provisioning | 🟨 Not runtime-verified | `handle_new_user` trigger on `auth.users`; shim emulates for DB tests |
| API-exposed schemas & grants | 🟨 Not runtime-verified | `public` schema; explicit grants to `anon`/`authenticated`; verified logically, not via PostgREST |
| RPC arg names & response shapes | 🟦 FE-verified (types) · 🟨 | adapter/`management.ts` map to `p_*` args; not called over PostgREST here |
| Public views & column access | ✅ DB-verified | views + grants tested |
| Realtime publication & subscriptions | 🟨 Not runtime-verified | publication guarded in `0010`; client subscribes with scoped channels |
| Supported public-key config | 🟦 FE-verified | anon/publishable key only; service-role key refused in client |
| Auth redirect handling | 🟦 FE-verified (config) · 🟨 (live) | `config.toml` + `redirectTo`/`emailRedirectTo` |
| Local Supabase stack run | ⛔ Blocked | Supabase CLI not installed; Docker daemon not running |
| Integration tests (2 sessions) | 🟨 Present, unexecuted | `src/integration/supabase.itest.ts`, gated on `TOGO_TEST_*`, self-skips |

## Blocked / not verified (summary)

- The **live Supabase path** (GoTrue login, PostgREST RPC, Realtime delivery) is
  not executed — no Supabase project/credentials here.
- **Email delivery** is not tested.
- A **local full Supabase stack** could not be started (no Docker daemon / CLI).

## Smallest next step toward a working shared pilot

1. Create a throwaway Supabase project; put its URL + anon key in `.env.local`.
2. `supabase db push` (migrations `0001`–`0013`), then optionally `supabase/seed.sql`.
3. Set Auth redirect URLs to your origin; sign up one user; promote to admin via
   the trusted SQL bootstrap (`docs/BACKEND.md §5`).
4. In the app's Admin console, create/approve a hub, add an operator + membership,
   a vehicle, a route with stops, and a departure; assign a conductor.
5. Run `npm run test:integration` with the `TOGO_TEST_*` vars pointed at that
   project to verify the two-session Auth+PostgREST+RLS path end-to-end.
