# Deploying ToGo

ToGo is three deployable pieces:

1. **Backend** — a Supabase project (Postgres + Auth + PostgREST + Realtime).
2. **Website** — the info page, operations console and legal pages (this repo root).
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
4. In **Authentication → URL Configuration**, set the Site URL to your website and
   add these redirect URLs: `togo://**` and `togostaff://**` (the apps), and
   `https://YOUR-SITE/console/auth/reset` (console password reset). Email-confirm
   and password-reset links then return to the right place.
5. Set the account security settings (email confirmation, password rules,
   leaked-password check, 8-digit email codes, email templates, security
   notifications, your own SMTP sender): the table in
   [BACKEND.md](BACKEND.md#account-security-settings).

### Option B — local stack (development)

`npm run backend:up` — see [LOCAL_BACKEND.md](LOCAL_BACKEND.md).

---

## 2. Website

The website is the public information page (`/`), the operations console
(`/console`, staff only) and the legal pages (`/legal/*.html`). All settings are
**build-time** and public (Vite inlines them):

| Variable | Used by | Value |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | console | your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | console | your Supabase anon/publishable key |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | info page, legal pages | support address (same as the apps) |
| `EXPO_PUBLIC_LEGAL_NAME`, `EXPO_PUBLIC_LEGAL_ADDRESS` | info page footer, legal pages | who runs ToGo (same as the apps) |
| `EXPO_PUBLIC_APP_STORE_URL`, `EXPO_PUBLIC_PLAY_STORE_URL` | info page | store links; until set the page says "coming soon" |
| `EXPO_PUBLIC_SENTRY_DSN` | legal pages | set when the apps use crash reporting, so the policy matches |

Without the two `VITE_*` values the info page still works and the console shows
"Setup needed". The legal pages and info page never need the backend.

### Vercel

`vercel.json` is included: Vite build, `/console/*` served by the console page
(marked `noindex`), long caching for hashed assets, and basic security headers.

1. Import the repo in Vercel (root directory = repo root).
2. Add the variables above under **Settings → Environment Variables** (Production +
   Preview).
3. Deploy. Vercel runs `npm ci` + `npm run build` and serves `dist/`.

Any other static host works the same way: build with the variables set, publish
`dist/`, and route `/console/*` to `/console/index.html`.

### Docker / any container host

A multi-stage `Dockerfile` (Node build → nginx, config in `deploy/nginx.conf`) is
included:

```bash
docker build -t togo-web \
  --build-arg VITE_SUPABASE_URL=https://YOUR-ref.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=YOUR-anon-key \
  --build-arg EXPO_PUBLIC_SUPPORT_EMAIL=help@example.com .
docker run -p 8080:80 togo-web            # http://localhost:8080
# or: docker compose up --build            (reads the values from your shell env)
```

Settings are baked in at build time, so build one image per environment.

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
- [ ] Website variables set on the host; `/console` shows the sign-in page (not "Setup needed").
- [ ] Auth redirect URLs include `togo://**`, `togostaff://**` and `/console/auth/reset`.
- [ ] Account security settings match [BACKEND.md](BACKEND.md#account-security-settings): confirm email on, minimum 8, leaked-password protection on, 8-digit codes for 30 minutes, ToGo email templates and security notifications, own SMTP sender.
- [ ] Sign up, confirm with the code, reset a password with the code: tried once on the production project.
- [ ] Push alerts set up (function, webhook, Firebase for Android): [BACKEND.md](BACKEND.md#push-alerts).
- [ ] First platform admin granted (see [BACKEND.md](BACKEND.md)); operators, hubs,
      and crew assigned to real accounts.
- [ ] Non-software prerequisites tracked in [MVP_READINESS.md](MVP_READINESS.md)
      (hub authorization, operator agreements, staff training, live field testing).
