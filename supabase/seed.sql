-- ToGo LOCAL/TEST seed data. Clearly fictional. Applied by `supabase db reset`.
-- No real operators, hubs, approvals, or partnerships are implied.
-- Staff assignments are NOT seeded here — assign real signed-up users via the
-- admin workspace (or SQL) after they create accounts. See docs/BACKEND.md.

-- Fixed ids so re-running is stable.
insert into public.operators (id, name, slug, rating) values
  ('11111111-0000-0000-0000-000000000001', 'Savannah Coaches (demo)', 'savannah-demo', 4.6),
  ('11111111-0000-0000-0000-000000000002', 'Pearl Express (demo)',   'pearl-demo',    4.4)
on conflict (id) do nothing;

insert into public.vehicles (id, operator_id, label, plate, capacity) values
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Coaster 33-seat', 'UAX 100T (demo)', 33),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'Coach 45-seat',   'UBG 305T (demo)', 45)
on conflict (id) do nothing;

-- Hubs are APPROVED test locations (approval is a platform decision; here we seed
-- an already-approved set for local development only — not a real-world approval).
insert into public.hubs (id, name, city, area, arrival_instructions, opening_hours, facilities, approval_status, is_active, is_demo, lat, lng) values
  ('33333333-0000-0000-0000-000000000001', 'Nakawa Green Hub (test)', 'Kampala', 'Near Nakawa, off Jinja Road (test location)', 'Look for the ToGo signpost by the covered bay. Arrive 15 min early.', '05:00 – 21:00 daily', '{"shelter":true,"seating":true,"toilets":true,"attendant":true,"water":true,"lighting":true}', 'approved', true, false, 0.327500, 32.612000),
  ('33333333-0000-0000-0000-000000000002', 'Ndeeba Roadside Point (test)', 'Kampala', 'Ndeeba, along Masaka Road (test location)', 'Wait at the marked shelter beside the fuel station.', '05:30 – 20:00 daily', '{"shelter":true,"seating":true,"toilets":false,"attendant":true,"water":false,"lighting":true}', 'approved', true, false, 0.296000, 32.560000),
  ('33333333-0000-0000-0000-000000000003', 'Mbarara Central Hub (test)', 'Mbarara', 'Central Mbarara, near High Street (test location)', 'The covered bay with ToGo branding. Attendant on duty during opening hours.', '05:00 – 21:00 daily', '{"shelter":true,"seating":true,"toilets":true,"attendant":true,"water":true,"lighting":true}', 'approved', true, false, -0.607000, 30.654000),
  ('33333333-0000-0000-0000-000000000004', 'Kakoba Roadside Point (test)', 'Mbarara', 'Kakoba, along the Kabale Road (test location)', 'Wait at the marked ToGo shelter near the roundabout.', '05:30 – 20:00 daily', '{"shelter":true,"seating":true,"toilets":false,"attendant":true,"water":false,"lighting":true}', 'approved', true, false, -0.630000, 30.660000)
on conflict (id) do nothing;

-- Routes (ordered pickup + destination stops).
insert into public.routes (id, operator_id, direction, origin_city, destination_city) values
  ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'KLA_MBR', 'Kampala', 'Mbarara'),
  ('44444444-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'MBR_KLA', 'Mbarara', 'Kampala')
on conflict (id) do nothing;

insert into public.route_stops (route_id, hub_id, stop_order) values
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 0),
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 1),
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000003', 2),
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000003', 0),
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000004', 1),
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000001', 2)
on conflict do nothing;

-- Generate a few departures for today and tomorrow (Africa/Kampala wall-clock),
-- with ordered trip_stops. Times are illustrative.
do $$
declare
  d int;
  svc date;
  dep timestamptz;
  v_trip uuid;
begin
  for d in 0..1 loop
    svc := current_date + d;

    -- Kampala -> Mbarara, 07:00 Savannah
    dep := (svc + time '07:00') at time zone 'Africa/Kampala';
    v_trip := gen_random_uuid();
    insert into public.trips (id, operator_id, route_id, vehicle_id, direction, service_date, origin_departure, destination_arrival, fare_ugx, capacity, status, booking_cutoff_minutes)
    values (v_trip, '11111111-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'KLA_MBR', svc, dep, dep + interval '4 hours', 25000, 33, 'scheduled', 30);
    insert into public.trip_stops (trip_id, hub_id, stop_order, pickup_time) values
      (v_trip, '33333333-0000-0000-0000-000000000001', 0, dep),
      (v_trip, '33333333-0000-0000-0000-000000000002', 1, dep + interval '20 minutes'),
      (v_trip, '33333333-0000-0000-0000-000000000003', 2, dep + interval '4 hours');

    -- Kampala -> Mbarara, 10:30 Pearl
    dep := (svc + time '10:30') at time zone 'Africa/Kampala';
    v_trip := gen_random_uuid();
    insert into public.trips (id, operator_id, route_id, vehicle_id, direction, service_date, origin_departure, destination_arrival, fare_ugx, capacity, status, booking_cutoff_minutes)
    values (v_trip, '11111111-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 'KLA_MBR', svc, dep, dep + interval '4 hours 15 minutes', 30000, 45, 'scheduled', 30);
    insert into public.trip_stops (trip_id, hub_id, stop_order, pickup_time) values
      (v_trip, '33333333-0000-0000-0000-000000000001', 0, dep),
      (v_trip, '33333333-0000-0000-0000-000000000002', 1, dep + interval '20 minutes'),
      (v_trip, '33333333-0000-0000-0000-000000000003', 2, dep + interval '4 hours 15 minutes');

    -- Mbarara -> Kampala, 08:00 Savannah
    dep := (svc + time '08:00') at time zone 'Africa/Kampala';
    v_trip := gen_random_uuid();
    insert into public.trips (id, operator_id, route_id, vehicle_id, direction, service_date, origin_departure, destination_arrival, fare_ugx, capacity, status, booking_cutoff_minutes)
    values (v_trip, '11111111-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'MBR_KLA', svc, dep, dep + interval '4 hours 10 minutes', 25000, 33, 'scheduled', 30);
    insert into public.trip_stops (trip_id, hub_id, stop_order, pickup_time) values
      (v_trip, '33333333-0000-0000-0000-000000000003', 0, dep),
      (v_trip, '33333333-0000-0000-0000-000000000004', 1, dep + interval '15 minutes'),
      (v_trip, '33333333-0000-0000-0000-000000000001', 2, dep + interval '4 hours 10 minutes');
  end loop;
end $$;
