-- 0007 Row Level Security: enable on every table and define policies.
-- Model: passengers see only their own bookings/notifications; operator staff see
-- their operator; attendants their hubs; conductors their trips; admins everything.
-- Base tables are locked down; passenger browsing happens through the public views
-- in 0008 and staff manifests through the SECURITY DEFINER functions in 0009.

alter table public.profiles          enable row level security;
alter table public.operators         enable row level security;
alter table public.operator_members  enable row level security;
alter table public.hubs              enable row level security;
alter table public.hub_staff         enable row level security;
alter table public.vehicles          enable row level security;
alter table public.routes            enable row level security;
alter table public.route_stops       enable row level security;
alter table public.trips             enable row level security;
alter table public.trip_stops        enable row level security;
alter table public.trip_staff        enable row level security;
alter table public.bookings          enable row level security;
alter table public.booking_events    enable row level security;
alter table public.location_updates  enable row level security;
alter table public.notifications     enable row level security;
alter table public.incidents         enable row level security;

-- Force RLS even for the table owner in tests except SECURITY DEFINER funcs which
-- run as owner and are exempted by BYPASSRLS on the owner role in Supabase.
-- (We do NOT force on owner so definer functions keep working.)

-- ------------------------- profiles -------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_platform_admin(auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ------------------------- operators -------------------------
-- Public may read active operators (names appear on trip cards).
create policy operators_select_public on public.operators
  for select to anon, authenticated using (is_active or public.is_operator_member(auth.uid(), id));
create policy operators_admin_all on public.operators
  for all to authenticated using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

-- ------------------------- operator_members -------------------------
create policy opmembers_select on public.operator_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_operator_member(auth.uid(), operator_id));
-- Only admins may create/modify privileged assignments (no self-promotion).
create policy opmembers_admin_write on public.operator_members
  for all to authenticated using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

-- ------------------------- hubs -------------------------
-- Base table is staff/admin only. Passengers/anon read the hubs_public view (0008).
create policy hubs_select_staff on public.hubs
  for select to authenticated
  using (public.is_platform_admin(auth.uid()) or public.is_hub_staff(auth.uid(), id));
create policy hubs_admin_write on public.hubs
  for all to authenticated using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

-- ------------------------- hub_staff -------------------------
create policy hubstaff_select on public.hub_staff
  for select to authenticated
  using (user_id = auth.uid() or public.is_hub_staff(auth.uid(), hub_id) or public.is_platform_admin(auth.uid()));
create policy hubstaff_admin_write on public.hub_staff
  for all to authenticated using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

-- ------------------------- vehicles -------------------------
create policy vehicles_select on public.vehicles
  for select to authenticated
  using (public.is_operator_member(auth.uid(), operator_id));
create policy vehicles_write on public.vehicles
  for all to authenticated
  using (public.is_operator_member(auth.uid(), operator_id))
  with check (public.is_operator_member(auth.uid(), operator_id));

-- ------------------------- routes / route_stops -------------------------
create policy routes_select on public.routes
  for select to authenticated using (public.is_operator_member(auth.uid(), operator_id));
create policy routes_write on public.routes
  for all to authenticated
  using (public.is_operator_member(auth.uid(), operator_id))
  with check (public.is_operator_member(auth.uid(), operator_id));

create policy routestops_select on public.route_stops
  for select to authenticated
  using (exists (select 1 from public.routes r where r.id = route_id
                 and public.is_operator_member(auth.uid(), r.operator_id)));
create policy routestops_write on public.route_stops
  for all to authenticated
  using (exists (select 1 from public.routes r where r.id = route_id
                 and public.is_operator_member(auth.uid(), r.operator_id)))
  with check (exists (select 1 from public.routes r where r.id = route_id
                 and public.is_operator_member(auth.uid(), r.operator_id)));

-- ------------------------- trips -------------------------
-- Base table select: operator staff, assigned trip staff, admin. Public browse via view.
create policy trips_select_staff on public.trips
  for select to authenticated
  using (public.is_operator_member(auth.uid(), operator_id) or public.is_trip_staff(auth.uid(), id));
-- Operator staff/admin can edit their trips directly (capacity guarded by trigger + RPC).
create policy trips_write on public.trips
  for all to authenticated
  using (public.is_operator_member(auth.uid(), operator_id))
  with check (public.is_operator_member(auth.uid(), operator_id));

-- ------------------------- trip_stops -------------------------
create policy tripstops_select_staff on public.trip_stops
  for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id
                 and (public.is_operator_member(auth.uid(), t.operator_id)
                      or public.is_trip_staff(auth.uid(), t.id))));
create policy tripstops_write on public.trip_stops
  for all to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id
                 and public.is_operator_member(auth.uid(), t.operator_id)))
  with check (exists (select 1 from public.trips t where t.id = trip_id
                 and public.is_operator_member(auth.uid(), t.operator_id)));

-- ------------------------- trip_staff -------------------------
create policy tripstaff_select on public.trip_staff
  for select to authenticated
  using (user_id = auth.uid()
         or public.is_operator_member(auth.uid(), public.trip_operator(trip_id)));
-- Only operator staff/admin may assign conductors (no self-assignment by conductors).
create policy tripstaff_write on public.trip_staff
  for all to authenticated
  using (public.is_operator_member(auth.uid(), public.trip_operator(trip_id)))
  with check (public.is_operator_member(auth.uid(), public.trip_operator(trip_id)));

-- ------------------------- bookings -------------------------
-- Passengers see ONLY their own bookings. Admins see all. Staff use RPC manifests
-- (0009) that return minimal columns — they get no direct row access to full PII.
create policy bookings_select_own on public.bookings
  for select to authenticated
  using (passenger_id = auth.uid() or public.is_platform_admin(auth.uid()));
-- No client INSERT/UPDATE/DELETE policies: all booking mutations go through the
-- SECURITY DEFINER functions in 0009.

-- ------------------------- booking_events (append-only audit) -------------------------
create policy bookingevents_select on public.booking_events
  for select to authenticated
  using (
    public.is_platform_admin(auth.uid())
    or exists (select 1 from public.bookings b where b.id = booking_id and b.passenger_id = auth.uid())
    or public.can_manage_trip(auth.uid(), trip_id)
  );
-- No insert/update/delete policies → immutable to clients; only definer funcs write.

-- ------------------------- location_updates -------------------------
create policy location_select on public.location_updates
  for select to authenticated
  using (
    public.can_manage_trip(auth.uid(), trip_id)
    or exists (
      select 1 from public.bookings b
      where b.trip_id = location_updates.trip_id
        and b.passenger_id = auth.uid()
        and b.status in ('reserved', 'checked_in', 'boarded')
    )
  );
-- Inserts happen only through report_location() (definer, checks assignment).

-- ------------------------- notifications -------------------------
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Inserts happen only through trusted definer functions.

-- ------------------------- incidents -------------------------
-- Staff/operator/admin see incidents (including private staff_notes). Passengers
-- never read incidents directly — they receive a service message via notifications.
create policy incidents_select_staff on public.incidents
  for select to authenticated
  using (
    public.is_platform_admin(auth.uid())
    or (operator_id is not null and public.is_operator_member(auth.uid(), operator_id))
    or (trip_id is not null and public.can_manage_trip(auth.uid(), trip_id))
    or (hub_id is not null and public.is_hub_staff(auth.uid(), hub_id))
  );
create policy incidents_insert_staff on public.incidents
  for insert to authenticated
  with check (
    reporter_id = auth.uid() and (
      public.is_platform_admin(auth.uid())
      or (operator_id is not null and public.is_operator_member(auth.uid(), operator_id))
      or (trip_id is not null and public.can_manage_trip(auth.uid(), trip_id))
      or (hub_id is not null and public.is_hub_staff(auth.uid(), hub_id))
    )
  );
create policy incidents_update_staff on public.incidents
  for update to authenticated
  using (
    public.is_platform_admin(auth.uid())
    or (operator_id is not null and public.is_operator_member(auth.uid(), operator_id))
    or (trip_id is not null and public.can_manage_trip(auth.uid(), trip_id))
    or (hub_id is not null and public.is_hub_staff(auth.uid(), hub_id))
  );
