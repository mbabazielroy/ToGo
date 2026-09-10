# ToGo — implementation status matrix

Backend-connected pilot. **Not** a real transport launch — all operators, hubs,
fares, schedules, tracking and "approvals" are illustrative.

## Legend / verification tiers

- ✅ **DB-verified** — exercised against a real PostgreSQL 16 via `npm run db:test`
  (69 RLS/transaction checks) and `npm run db:concurrency`. This is the actual
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
| Bootstrap requires an explicit trusted authority | ✅ DB-verified | `0014` guard: admin-JWT **or** explicit `togo.admin_bootstrap` marker — no role inference. `sec: trusted role WITHOUT bootstrap marker is denied`, `sec: explicit bootstrap marker allows the change` |
| Role alone is not accepted as proof of trust | ✅ DB-verified | `sec: trusted role WITHOUT bootstrap marker is denied` (even `service_role` blocked without the marker) |
| Public functions cannot bypass this | ✅ DB-verified | No client-executable definer touches `is_platform_admin`; `admin_set_platform_admin` checks caller is admin |
| Views/grants/manifest don't leak PII/credentials | ✅ DB-verified | `exposure: public views expose no credentials/contacts/internal notes`, `exposure: manifest exposes no credential/phone` |

Trust boundary (final, migration `0014`): a change to `is_platform_admin` is
allowed **only** when the caller is an admin identified by JWT (covers a definer
invoked by a user, since the JWT persists into definers) **or** the explicit
`togo.admin_bootstrap` session marker is set — which only a direct-SQL/superuser
context can do. No role inference. `0011`'s interim "trusted when `current_user`
isn't an end-user role" was replaced because `current_user` becomes `postgres`
inside any `postgres`-owned definer, so a role check is not proof of trust.

**Exploitability of the earlier condition:** not exploitable through the actual
grants/call paths — the only definer that writes `is_platform_admin`
(`admin_set_platform_admin`) requires an admin JWT and isn't granted to `anon`, and
`handle_new_user` hard-codes `false`. It was a dangerous latent weakness, not an
accessible escalation. `0014` removes it regardless.

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
| Unboarded-at-completion classified correctly | ✅ DB-verified | checked-in→`missed_pickup` (+unresolved, +investigation incident); reserved-only→`not_boarded` (neutral, no fault, no incident); boarded→`completed`; cancelled untouched. `outcome: …` tests |
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
| Integration tests (2 sessions, real assertions) | 🟨 Present, **unexecuted** | `src/integration/supabase.itest.ts` — 7 tests: passenger auth, trip browse, reserve+idempotency, cross-session manifest visibility, cross-user + cross-operator denial, Realtime delivery, missed-pickup on completion, logout cleanup. Gated on `TOGO_TEST_*`; self-skips (reported as unverified, never passed) |
| Automated CI | 🟦 Added | `.github/workflows/ci.yml`: `checks` (typecheck/lint/test/build) + `database` (Postgres service runs the 69 RLS/txn checks + concurrency) on every push; opt-in `integration` job on manual dispatch with `TOGO_TEST_*` secrets |

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
