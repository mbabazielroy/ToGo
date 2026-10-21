# Running ToGo on a real local backend

ToGo's **connected mode** (the default) talks to a real Supabase backend — Postgres,
Auth, PostgREST, and Realtime. You do **not** need a hosted Supabase project to run it
end to end: the Supabase CLI spins up the whole stack locally in Docker, and the
scripts here apply every migration, seed demo data, and wire the app's `.env` for you.

This is the fully-working application running against a genuine backend (real
accounts, real shared data, real row-level security) — not the simulated preview.

## Prerequisites (install once)

- **Docker Desktop**, running — https://docs.docker.com/get-docker/
- **Supabase CLI** — https://supabase.com/docs/guides/cli
  (or skip the install: the scripts fall back to `npx --yes supabase`)
- **Node 20+** and `npm ci` already run at the repo root.

## One command

```bash
npm run backend:up
```

That runs `scripts/local-backend.sh up`, which:

1. Preflights Docker + the Supabase CLI (and tells you exactly what to install if a
   piece is missing).
2. `supabase start` — boots Postgres, Auth (GoTrue), PostgREST, Realtime, Studio, and
   a mail catcher (Inbucket). The first run pulls Docker images.
3. `supabase db reset` — applies **all** migrations in `supabase/migrations/` and the
   demo data in `supabase/seed.sql` (operators, approved test hubs, routes, and
   departures for **today + tomorrow** in Africa/Kampala).
4. Writes `.env.local` (web) and `apps/mobile/.env` (mobile) with the local API URL +
   **anon** key, so the apps run in connected mode against this stack. (Only the public
   URL and anon key are written — never the service-role key.)

Then run the app in connected mode:

```bash
npm run dev          # http://localhost:5173  (Vite auto-loads .env.local)
```

Useful local URLs (defaults):

| What            | URL                       |
| --------------- | ------------------------- |
| App (web)       | http://localhost:5173     |
| Supabase Studio | http://127.0.0.1:54323    |
| Mailbox (Inbucket) — sign-up & reset emails land here | http://127.0.0.1:54324 |
| API / Auth      | http://127.0.0.1:54321    |

## Create an account, then become staff

Public sign-up **always** creates a *passenger* (enforced by the `handle_new_user`
trigger — no client metadata is trusted). To see the staff workspaces, grant a role to
a signed-up user:

```bash
# 1) In the app, create an account (Account → it prompts to sign in / create account).
#    Confirmation email (if enabled) appears in the Inbucket mailbox above.

# 2) Grant a role on the local DB (list targets by omitting the id):
scripts/grant-staff.sh you@example.com admin
scripts/grant-staff.sh you@example.com operator              # lists operators
scripts/grant-staff.sh you@example.com operator <operator_id>
scripts/grant-staff.sh you@example.com hubstaff  <hub_id>
scripts/grant-staff.sh you@example.com conductor <trip_id>
scripts/grant-staff.sh you@example.com driver    <trip_id>

# 3) Sign out / in (or refresh) to pick up the new assignment.
```

`admin` uses the documented `togo.admin_bootstrap` trusted-context path; the others
insert the verified `operator_members` / `hub_staff` / `trip_staff` records the app
resolves server-side. This mirrors exactly what a real administrator would do.

## Everyday commands

```bash
npm run backend:up        # start + migrate + seed + write env
npm run backend:reset     # re-apply migrations + seed (fresh demo data)
npm run backend:env       # (re)write .env files from the running stack
npm run backend:status    # URLs + keys of the running stack
npm run backend:down      # stop the stack (local data kept)
```

## Mobile against the local backend

`npm run backend:up` writes `apps/mobile/.env` pointing at `127.0.0.1:54321`. A phone
or emulator can't reach your computer's `localhost`, so for a real device edit that
file and replace `127.0.0.1` with your computer's LAN IP (e.g.
`http://192.168.1.20:54321`), then start Metro: `cd apps/mobile && npm start`.

## Verifying the database layer without Docker

The SQL the local stack applies (every migration + the RLS policies) is proven against
a **real PostgreSQL** by the test suite, independent of the CLI/Docker:

```bash
npm run db:test          # applies the auth shim + all migrations, runs the RLS suite
```

> Note for this build environment: the Supabase CLI local stack needs Docker, which is
> not available in the cloud build container used to author ToGo. The config and
> scripts here are therefore verified by (a) the `db:test` suite proving the migrations
> + policies, and (b) applying `supabase/seed.sql` on top of the migrations in a
> scratch database. Running `supabase start` itself is done on a developer machine with
> Docker.
