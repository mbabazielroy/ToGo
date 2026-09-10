-- ToGo pilot schema — 0001 init: extensions and enums.
-- All money is integer UGX. All instants are timestamptz. Display in Africa/Kampala.

create extension if not exists pgcrypto;      -- gen_random_uuid(), gen_random_bytes()
create extension if not exists citext;        -- case-insensitive text (emails/refs)

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type direction as enum ('KLA_MBR', 'MBR_KLA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type trip_status as enum ('scheduled', 'boarding', 'en_route', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum ('reserved', 'checked_in', 'boarded', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pay_at_boarding', 'paid', 'waived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type hub_approval as enum ('draft', 'pending', 'approved', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type operator_role as enum ('owner', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type trip_staff_role as enum ('conductor', 'driver');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_event_kind as enum (
    'reserved', 'cancelled', 'checked_in', 'boarded', 'completed',
    'unresolved_pickup', 'trip_cancelled', 'schedule_changed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_kind as enum (
    'booking_confirmed', 'schedule_changed', 'delay', 'trip_cancelled',
    'checked_in', 'boarded', 'incident'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type incident_kind as enum ('breakdown', 'missed_pickup', 'left_unboarded', 'hub_unavailable', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type incident_status as enum ('open', 'acknowledged', 'resolved');
exception when duplicate_object then null; end $$;
