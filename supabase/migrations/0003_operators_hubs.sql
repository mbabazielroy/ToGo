-- 0003 operators, memberships, hubs, hub staff, vehicles, routes, route stops.

create table if not exists public.operators (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        citext unique not null,
  rating      numeric(2,1) not null default 4.5 check (rating >= 0 and rating <= 5),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Operator staff (owner/staff). "operator staff" role in the product.
create table if not exists public.operator_members (
  operator_id uuid not null references public.operators (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        operator_role not null default 'staff',
  created_at  timestamptz not null default now(),
  primary key (operator_id, user_id)
);
create index if not exists idx_operator_members_user on public.operator_members (user_id);

-- Hubs. Passenger-visible fields vs internal approval/operational fields.
-- Only approval_status='approved' AND is_active AND NOT is_demo are bookable in connected mode.
create table if not exists public.hubs (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  city                  text not null,
  area                  text not null,
  arrival_instructions  text not null default '',
  opening_hours         text not null default '',
  facilities            jsonb not null default '{}'::jsonb,
  -- schematic coordinates only (not used as geographic truth)
  lat                   numeric(9,6),
  lng                   numeric(9,6),
  is_demo               boolean not null default false,
  approval_status       hub_approval not null default 'draft',
  is_active             boolean not null default true,
  -- internal, non passenger-visible:
  internal_notes        text,
  approved_by           uuid references auth.users (id),
  approved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_hubs_bookable on public.hubs (approval_status, is_active) where is_demo = false;

comment on column public.hubs.internal_notes is 'Internal only — never exposed to passengers.';

-- Hub attendants.
create table if not exists public.hub_staff (
  hub_id      uuid not null references public.hubs (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (hub_id, user_id)
);
create index if not exists idx_hub_staff_user on public.hub_staff (user_id);

create table if not exists public.vehicles (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators (id) on delete cascade,
  label       text not null,
  plate       text not null,
  capacity    integer not null check (capacity > 0 and capacity <= 200),
  created_at  timestamptz not null default now()
);
create index if not exists idx_vehicles_operator on public.vehicles (operator_id);

create table if not exists public.routes (
  id               uuid primary key default gen_random_uuid(),
  operator_id      uuid not null references public.operators (id) on delete cascade,
  direction        direction not null,
  origin_city      text not null,
  destination_city text not null,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists idx_routes_operator on public.routes (operator_id);

create table if not exists public.route_stops (
  id          uuid primary key default gen_random_uuid(),
  route_id    uuid not null references public.routes (id) on delete cascade,
  hub_id      uuid not null references public.hubs (id) on delete restrict,
  stop_order  integer not null check (stop_order >= 0),
  created_at  timestamptz not null default now(),
  unique (route_id, stop_order)
);
create index if not exists idx_route_stops_route on public.route_stops (route_id);
