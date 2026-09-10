-- 0006 location updates, in-app notifications, operational incidents.

create table if not exists public.location_updates (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  reporter_id  uuid not null references auth.users (id) on delete cascade,
  lat          numeric(9,6) not null check (lat >= -90 and lat <= 90),
  lng          numeric(9,6) not null check (lng >= -180 and lng <= 180),
  accuracy_m   numeric(8,2) check (accuracy_m is null or accuracy_m >= 0),
  observed_at  timestamptz not null,   -- when the device measured it
  received_at  timestamptz not null default now(), -- when the server stored it
  created_at   timestamptz not null default now()
);
create index if not exists idx_location_updates_trip on public.location_updates (trip_id, received_at desc);

comment on table public.location_updates is 'Foreground staff location samples. Not a geographic ETA source. Passenger sees freshness only.';

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        notification_kind not null,
  title       text not null,
  body        text not null default '',
  trip_id     uuid references public.trips (id) on delete set null,
  booking_id  uuid references public.bookings (id) on delete set null,
  -- Dedupe key prevents duplicate notifications during retries.
  dedupe_key  text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);
create unique index if not exists uq_notifications_dedupe
  on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

create table if not exists public.incidents (
  id               uuid primary key default gen_random_uuid(),
  kind             incident_kind not null,
  trip_id          uuid references public.trips (id) on delete set null,
  hub_id           uuid references public.hubs (id) on delete set null,
  booking_id       uuid references public.bookings (id) on delete set null,
  operator_id      uuid references public.operators (id) on delete set null,
  reporter_id      uuid references auth.users (id),
  status           incident_status not null default 'open',
  -- Staff notes are private to staff; passenger_message is the service message shown to affected passengers.
  staff_notes      text,
  passenger_message text,
  resolution       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  resolved_at      timestamptz
);
create index if not exists idx_incidents_trip on public.incidents (trip_id);
create index if not exists idx_incidents_operator on public.incidents (operator_id, status);
