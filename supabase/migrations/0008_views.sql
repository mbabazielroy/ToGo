-- 0008 Passenger-facing views. These are owned by the migration role and expose
-- ONLY safe columns for bookable rows, so passengers never touch internal columns
-- or another passenger's data. Aggregates (seat counts) are computed here so they
-- do not require row access to other people's bookings.

-- Bookable hubs only, internal columns stripped.
create or replace view public.hubs_public as
  select
    h.id, h.name, h.city, h.area, h.arrival_instructions,
    h.opening_hours, h.facilities, h.lat, h.lng, h.is_demo
  from public.hubs h
  where h.approval_status = 'approved'
    and h.is_active = true
    and h.is_demo = false;

comment on view public.hubs_public is 'Passenger-visible hubs: approved, active, non-demo. No internal notes or approval metadata.';

-- Public trip browse with operator/vehicle labels and live availability.
create or replace view public.trips_public as
  select
    t.id,
    t.operator_id,
    o.name              as operator_name,
    o.rating            as operator_rating,
    v.label             as vehicle_label,
    t.direction,
    t.service_date,
    t.origin_departure,
    t.destination_arrival,
    t.fare_ugx,
    t.capacity,
    t.status,
    t.delay_minutes,
    t.booking_cutoff_minutes,
    t.progress,
    t.last_update,
    coalesce((
      select sum(b.seats) from public.bookings b
      where b.trip_id = t.id and b.status in ('reserved','checked_in','boarded')
    ), 0)::int          as seats_reserved,
    (t.capacity - coalesce((
      select sum(b.seats) from public.bookings b
      where b.trip_id = t.id and b.status in ('reserved','checked_in','boarded')
    ), 0))::int         as seats_available
  from public.trips t
  join public.operators o on o.id = t.operator_id
  left join public.vehicles v on v.id = t.vehicle_id
  where o.is_active = true
    and t.status <> 'cancelled';

comment on view public.trips_public is 'Passenger-visible trips. No passenger lists, contacts, credentials, or incidents.';

-- Public ordered pickup stops for bookable trips (active stops at bookable hubs).
create or replace view public.trip_stops_public as
  select
    ts.id,
    ts.trip_id,
    ts.hub_id,
    hp.name  as hub_name,
    hp.city  as hub_city,
    ts.stop_order,
    ts.pickup_time,
    ts.reached
  from public.trip_stops ts
  join public.hubs_public hp on hp.id = ts.hub_id
  where ts.is_active = true;

comment on view public.trip_stops_public is 'Passenger-visible ordered stops at bookable hubs only.';

-- ---------------------------------------------------------------------------
-- Notifications update guard: passengers may only flip read_at, nothing else.
-- ---------------------------------------------------------------------------
create or replace function public.notifications_guard()
returns trigger
language plpgsql
as $$
begin
  if row(new.id, new.user_id, new.kind, new.title, new.body, new.trip_id, new.booking_id, new.dedupe_key, new.created_at)
     is distinct from
     row(old.id, old.user_id, old.kind, old.title, old.body, old.trip_id, old.booking_id, old.dedupe_key, old.created_at)
  then
    raise exception 'Only read_at may be updated on a notification';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_guard_trg on public.notifications;
create trigger notifications_guard_trg
  before update on public.notifications
  for each row execute function public.notifications_guard();

-- Keep hubs.updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists hubs_touch on public.hubs;
create trigger hubs_touch before update on public.hubs
  for each row execute function public.touch_updated_at();

drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

drop trigger if exists incidents_touch on public.incidents;
create trigger incidents_touch before update on public.incidents
  for each row execute function public.touch_updated_at();
