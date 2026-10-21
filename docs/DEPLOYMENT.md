# Deploying ToGo

ToGo is three deployable pieces:

1. **Backend** — a Supabase project (Postgres + Auth + PostgREST + Realtime).
2. **Web app** — a static Vite SPA (this repo root).
3. **Mobile app** — the Expo app in `apps/mobile` (store/EAS builds).

Everything below is **configuration** — this session created no live cloud resources.
Provision the backend and deploy the clients from your own accounts when ready.

---

## 1. Backend (Supabase)

### Option A — hosted project (production)

1. Create a project at https://supabase.com (note the **project ref**).
2. Apply the schema. With the Supabase CLI:
   ```bash
   supabase link --project-ref YOUR_REF
   supabase db push          # applies supabase/migrations/* in order
   ```
   (Seeding `supabase/seed.sql` is for local/dev only — do not seed demo operators
   into production.)
3. In **Project Settings → API**, copy the **Project URL** and the **anon/publishable**
   key. These are the only backend values the clients need. **Never** ship the
   `service_role` key to a client.
4. In **Authentication → URL Configuration**, set the Site URL and add your deployed
   web URL(s) and the mobile scheme (`togo://`) to the redirect allow-list, so
   email-confirm and password-reset links return to the app.

### Option B — local stack (development)

`npm run backend:up` — see [LOCAL_BACKEND.md](LOCAL_BACKEND.md).

---

## 2. Web app

The web app reads two **build-time** public env vars (Vite inlines them):

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon/publishable key |

Without them the app serves the honest **"Setup needed"** screen — it never silently
opens demo mode. (The local preview build sets `VITE_TOGO_DEMO=1` instead; never set
that for a real deploy.)

### Vercel

`vercel.json` is included (Vite framework, SPA rewrite to `/index.html`, asset
caching). Steps:

1. Import the repo in Vercel (root directory = repo root).
2. Add the two `VITE_*` vars under **Settings → Environment Variables** (Production +
   Preview).
3. Deploy. Vercel runs `npm ci` + `npm run build` and serves `dist/`.

Any other static host (Netlify, Cloudflare Pages, S3+CloudFront, GitHub Pages) works
the same way: build with the two env vars set, publish `dist/`, and add an SPA
fallback rewrite of all paths to `/index.html`.

### Docker / any container host

A multi-stage `Dockerfile` (Node build → nginx serve, with the SPA fallback in
`deploy/nginx.conf`) is included:

```bash
docker build -t togo-web \
  --build-arg VITE_SUPABASE_URL=https://YOUR-ref.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=YOUR-anon-key .
docker run -p 8080:80 togo-web            # http://localhost:8080
# or: docker compose up --build            (reads the vars from your shell env)
```

Because the Supabase config is baked at build time, build one image per environment
(or rebuild on config change). Push the image to any registry and run it on Fly.io,
Cloud Run, ECS, a VM, etc.

---

## 3. Mobile app (Expo)

The mobile app reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
(public, embedded at build time). Create `apps/mobile/.env` from `.env.example`.

Installable builds use EAS (an `eas.json` starting point is in `apps/mobile`):

```bash
cd apps/mobile
npm i -g eas-cli && eas login            # free Expo account
eas build -p android --profile preview   # APK/AAB
eas build -p ios --profile preview       # needs an Apple Developer account for signing
```

For the auth return links (email confirm / password reset) to open the app, add the
app's `togo://` redirect URLs to the Supabase Auth allow-list (see Backend step 4);
this needs a dev/standalone build rather than plain Expo Go. Email/password sign-in
works in Expo Go without it. Full detail: [MOBILE.md](MOBILE.md).

---

## Pre-launch checklist

- [ ] Supabase project created; `supabase db push` applied all migrations.
- [ ] Web `VITE_*` env set on the host; a test build shows the app (not "Setup needed").
- [ ] Auth redirect URLs include the web origin and `togo://` scheme.
- [ ] First platform admin granted (see [BACKEND.md](BACKEND.md)); operators, hubs,
      and crew assigned to real accounts.
- [ ] Non-software prerequisites tracked in [MVP_READINESS.md](MVP_READINESS.md)
      (hub authorization, operator agreements, staff training, live field testing).
