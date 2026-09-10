# ToGo — remote setup from a phone

A short, do-it-on-your-phone checklist to bring up a **disposable test** ToGo pilot
backend and run the real checks — without a laptop. You'll use the Supabase
dashboard (works in a mobile browser) and a remote coding environment (e.g. Claude
Code on the web) for commands.

> Safety rules (please follow):
> - **Never paste** a database password, `service_role` key, or JWT secret into
>   chat, screenshots, or a git commit. Only the **public anon key** goes in the app.
> - Use a **throwaway** Supabase project for testing — not one with real data.
> - Frontend env values are **baked in at build time**. If you change them you must
>   **rebuild** the app for the change to take effect.

---

## 1. Create a dedicated Supabase test project
1. Sign in at supabase.com → **New project** (free tier is fine). Name it e.g.
   `togo-pilot-test`.
2. Wait for it to provision. Keep the tab open.

## 2. Apply the database migrations (in order)
Easiest on a phone: **SQL Editor**.
1. Left menu → **SQL Editor** → **New query**.
2. Open the repo's `supabase/migrations/` and run each file **in numeric order**,
   `0001` → `0016`, one at a time (paste, **Run**, repeat). Order matters, and the
   two `ADD VALUE` enum files (`0012`, `0015`) must each be run before the files
   that use them — running one-at-a-time handles this.
3. Do **not** run anything from `supabase/tests/` against this project — that's
   local test-only scaffolding.
4. Optional sample departures (test project only): run `supabase/seed.sql`.

*(If you have the Supabase CLI in a remote coding environment instead:
`supabase link` then `supabase db push`.)*

## 3. Get the public frontend values
1. Left menu → **Project Settings → API**.
2. Copy the **Project URL** and the **anon / public** key (NOT `service_role`).
3. In your remote coding environment, create `.env.local` in the repo root:
   ```
   VITE_SUPABASE_URL=<the Project URL>
   VITE_SUPABASE_ANON_KEY=<the anon public key>
   ```
   These are safe to embed in the browser build. **Remember:** changing them later
   means you must **rebuild**.

## 4. Configure Auth URLs (after you have a frontend address)
You only need this once the app is served somewhere (a preview/dev URL).
1. **Authentication → URL Configuration**.
2. Set **Site URL** to your app's address.
3. Add that same address to **Redirect URLs** (email confirmation and password
   reset links return to `‹address›/` and `‹address›/auth/reset`).
4. For quick testing you may turn **off** email confirmations under
   **Authentication → Providers → Email** so testers can sign in immediately.

## 5. Securely bootstrap the first administrator
Public signup only ever creates a **passenger**. To make the first admin:
1. In the app, **sign up** with the email that should be admin.
2. Supabase dashboard → **Authentication → Users**, copy that user's **UUID**.
3. **SQL Editor → New query**, paste and **Run** (this uses an explicit,
   deliberate trust marker — the only non-app way to grant admin):
   ```sql
   begin;
   set local togo.admin_bootstrap = 'on';
   update public.profiles set is_platform_admin = true where id = '<PASTE-UUID>';
   commit;
   ```
   Do this **only** in the SQL Editor (a trusted context). Never expose a way to set
   that marker from the app. After this, that admin can promote others in-app.

## 6. Create test operational records (in the app, no SQL)
Sign in as the admin, then use the in-app consoles:
1. **Admin**: create an **operator**; create at least one **hub** per city and
   **Approve** each; assign the operator's staff (operator membership) and any hub
   attendants (paste their user UUIDs from the Auth dashboard).
2. **Operator**: add a **vehicle**; create a **route** and set its ordered **stops**
   (approved hubs only); create a **departure** with stop times; assign a
   **conductor**.
3. Now a passenger can sign up, search, book, check in, and be boarded; staff
   workspaces appear automatically based on their assignments.

## 7. Run the real integration checks (remote coding environment)
The two-session Auth + PostgREST + Realtime suite is opt-in and only runs when you
provide test-only values. In a remote coding environment (not committed anywhere):
```
TOGO_TEST_SUPABASE_URL=…  TOGO_TEST_SUPABASE_ANON_KEY=… \
TOGO_TEST_PASSENGER_EMAIL=…  TOGO_TEST_PASSENGER_PASSWORD=… \
TOGO_TEST_CONDUCTOR_EMAIL=…  TOGO_TEST_CONDUCTOR_PASSWORD=… \
TOGO_TEST_TRIP_ID=…  TOGO_TEST_PICKUP_STOP_ID=…  TOGO_TEST_DROPOFF_STOP_ID=… \
npm run test:integration
```
Optional extra accounts enable more checks: `TOGO_TEST_PASSENGER2_*` (cross-user),
`TOGO_TEST_OTHER_STAFF_*` (cross-operator), and `TOGO_TEST_COMPLETABLE_TRIP_ID` (a
disposable trip for the destructive check-in→complete→missed-pickup flow).

- These use only the **anon** key and per-user passwords — never a service-role key.
- The suite isolates its data with a per-run key and cancels what it creates.
- If you don't set these, the suite **skips** — that is *unverified*, not passed.

You can also wire these as GitHub Actions **secrets** and run the `integration` job
via **Actions → CI → Run workflow** with `run_integration = true`. The `checks` and
`database` CI jobs run automatically on every push and need no secrets.

---

### What's already verified vs. what needs you
- The database policies, transactions, capacity race, security guard, and outcome
  classification are verified against a real PostgreSQL in CI (`database` job) and
  locally — see `docs/IMPLEMENTATION_STATUS.md`.
- The live GoTrue/PostgREST/Realtime path is **not** verified until you run step 7
  against your test project. Email delivery is likewise only verified once you send
  a real confirmation/reset from your project.
