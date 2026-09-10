-- 0010 Grants. RLS restricts rows; these grants restrict table/verb access.
-- Booking mutations are never granted directly — they flow through the RPCs.

grant usage on schema public to anon, authenticated;

-- Reads (RLS still applies per policy).
grant select on public.profiles, public.operators, public.operator_members,
  public.hubs, public.hub_staff, public.vehicles, public.routes, public.route_stops,
  public.trips, public.trip_stops, public.trip_staff, public.bookings,
  public.booking_events, public.location_updates, public.notifications, public.incidents
  to authenticated;

-- anon may read active operators only (used by public views / trip cards).
grant select on public.operators to anon;

-- Passenger-facing views.
grant select on public.hubs_public, public.trips_public, public.trip_stops_public
  to anon, authenticated;

-- Direct writes for operator/admin-managed configuration (RLS scopes them).
grant insert, update, delete on public.operators, public.operator_members,
  public.hubs, public.hub_staff, public.vehicles, public.routes, public.route_stops,
  public.trips, public.trip_stops, public.trip_staff to authenticated;

-- Profiles: self-service update. Notifications: mark-read update. Incidents: staff writes.
grant update on public.profiles to authenticated;
grant update on public.notifications to authenticated;
grant insert, update on public.incidents to authenticated;

-- Bookings, booking_events, location_updates: NO direct DML for clients.
revoke insert, update, delete on public.bookings from anon, authenticated;
revoke insert, update, delete on public.booking_events from anon, authenticated;
revoke insert, update, delete on public.location_updates from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Function execution: lock everything down, then grant only client-facing RPCs.
-- Internal helpers (_gen_reference, _log_event, _notify) stay ungranted.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public;

grant execute on function
  public.reserve_booking(uuid, uuid, uuid, integer, text, text, text),
  public.cancel_booking(uuid),
  public.check_in_booking(uuid),
  public.check_in_by_reference(text),
  public.board_booking(uuid, text),
  public.update_trip_status(uuid, trip_status),
  public.report_delay(uuid, integer),
  public.reach_hub(uuid, uuid),
  public.cancel_trip(uuid, text),
  public.record_unresolved_pickup(uuid, uuid, text),
  public.operator_update_trip(uuid, integer, integer, trip_status, timestamptz),
  public.deactivate_trip_stop(uuid),
  public.report_location(uuid, numeric, numeric, numeric, timestamptz),
  public.mark_notification_read(uuid),
  public.get_trip_manifest(uuid),
  public.get_hub_expected(uuid)
  to authenticated;

-- Permission helpers may be evaluated by policies for any authenticated user.
grant execute on function
  public.is_platform_admin(uuid),
  public.is_operator_member(uuid, uuid),
  public.is_hub_staff(uuid, uuid),
  public.is_trip_staff(uuid, uuid),
  public.can_manage_trip(uuid, uuid),
  public.trip_operator(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: publish the tables passengers/staff subscribe to. Guarded so the
-- migration also runs on a plain Postgres without the Supabase publication.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.trips;
    alter publication supabase_realtime add table public.bookings;
    alter publication supabase_realtime add table public.notifications;
    alter publication supabase_realtime add table public.location_updates;
    alter publication supabase_realtime add table public.booking_events;
    alter publication supabase_realtime add table public.incidents;
  end if;
exception when duplicate_object then null;
end $$;
