-- 0004 trips, ordered trip stops, trip staff assignments.

create table if not exists public.trips (
  id                    uuid primary key default gen_random_uuid(),
  operator_id           uuid not null references public.operators (id) on delete cascade,
  route_id              uuid references public.routes (id) on delete set null,
  vehicle_id            uuid references public.vehicles (id) on delete set null,
  direction             direction not null,
  service_date          date not null,
  origin_departure      timestamptz not null,
  destination_arrival   timestamptz not null,
  fare_ugx              integer not null check (fare_ugx >= 0),
  capacity              integer not null check (capacity > 0 and capacity <= 200),
  status                trip_status not null default 'scheduled',
  delay_minutes         integer not null default 0 check (delay_minutes >= 0),
  -- Reservations close this many minutes before origin departure.
  booking_cutoff_minutes integer not null default 0 check (booking_cutoff_minutes >= 0),
  progress              numeric(4,3) not null default 0 check (progress >= 0 and progress <= 1),
  cancel_reason         text,
  last_update           timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  check (destination_arrival >= origin_departure)
);
create index if not exists idx_trips_operator on public.trips (operator_id);
create index if not exists idx_trips_date_dir on public.trips (service_date, direction);
create index if not exists idx_trips_status on public.trips (status);

create table if not exists public.trip_stops (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  hub_id      uuid not null references public.hubs (id) on delete restrict,
  stop_order  integer not null check (stop_order >= 0),
  pickup_time timestamptz not null,
  reached     boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (trip_id, stop_order)
);
create index if not exists idx_trip_stops_trip on public.trip_stops (trip_id);
create index if not exists idx_trip_stops_hub on public.trip_stops (hub_id);

-- Conductors / drivers assigned to a trip.
create table if not exists public.trip_staff (
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        trip_staff_role not null default 'conductor',
  created_at  timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index if not exists idx_trip_staff_user on public.trip_staff (user_id);
