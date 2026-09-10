-- 0005 bookings and append-only booking events (audit).

create table if not exists public.bookings (
  id                    uuid primary key default gen_random_uuid(),
  trip_id               uuid not null references public.trips (id) on delete restrict,
  passenger_id          uuid not null references auth.users (id) on delete cascade,
  -- Booked stops (snapshot references kept even if the stop is later edited).
  pickup_stop_id        uuid not null references public.trip_stops (id) on delete restrict,
  dropoff_stop_id       uuid not null references public.trip_stops (id) on delete restrict,
  pickup_hub_id         uuid not null references public.hubs (id) on delete restrict,
  dropoff_hub_id        uuid not null references public.hubs (id) on delete restrict,
  seats                 integer not null check (seats >= 1 and seats <= 10),
  status                booking_status not null default 'reserved',
  payment_status        payment_status not null default 'pay_at_boarding',
  -- Snapshots taken at reservation time so later edits never change what was booked.
  fare_ugx_snapshot     integer not null check (fare_ugx_snapshot >= 0),
  pickup_time_snapshot  timestamptz not null,
  dropoff_time_snapshot timestamptz not null,
  reference             text not null unique,
  -- Opaque boarding credential embedded in the QR. Contains no personal data.
  boarding_credential   text not null unique,
  -- Idempotency: key + a fingerprint of the request; reuse with a different
  -- fingerprint must fail. Enforced in the reserve function.
  idempotency_key       text,
  request_fingerprint   text,
  passenger_name        text not null,
  passenger_phone       text,
  unresolved            boolean not null default false,
  checked_in_at         timestamptz,
  boarded_at            timestamptz,
  cancelled_at          timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_bookings_trip on public.bookings (trip_id);
create index if not exists idx_bookings_passenger on public.bookings (passenger_id);
create index if not exists idx_bookings_pickup_hub on public.bookings (pickup_hub_id);
create index if not exists idx_bookings_status on public.bookings (trip_id, status);
-- Idempotency key is unique per passenger when present.
create unique index if not exists uq_bookings_idempotency
  on public.bookings (passenger_id, idempotency_key)
  where idempotency_key is not null;

-- Fast capacity accounting: total seats held by active bookings on a trip.
-- (reserved | checked_in | boarded consume capacity; completed no longer does,
--  but a trip is completed as a whole so this is only reached post-trip.)
create index if not exists idx_bookings_active_seats
  on public.bookings (trip_id) where status in ('reserved', 'checked_in', 'boarded');

comment on column public.bookings.boarding_credential is 'Opaque high-entropy token shown in the QR. No PII. Validated by trip staff only.';

-- ---------------------------------------------------------------------------
-- Append-only audit log. Written only by SECURITY DEFINER functions (which run
-- as the table owner and bypass RLS). No UPDATE/DELETE is ever granted.
-- ---------------------------------------------------------------------------
create table if not exists public.booking_events (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid references public.bookings (id) on delete cascade,
  trip_id     uuid references public.trips (id) on delete cascade,
  kind        booking_event_kind not null,
  actor_id    uuid references auth.users (id),
  message     text not null default '',
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_booking_events_booking on public.booking_events (booking_id);
create index if not exists idx_booking_events_trip on public.booking_events (trip_id, created_at desc);
