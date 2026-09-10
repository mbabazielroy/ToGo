// Supabase INTEGRATION tests — real GoTrue (Auth) + PostgREST (RPC/REST) +
// Realtime with TWO separate authenticated sessions (a passenger and a conductor).
// NOT run by `npm test`. Run explicitly:  npm run test:integration
//
// SKIPPED unless an explicitly-designated DISPOSABLE test environment is provided,
// so they can never run against an arbitrary/production database. Required env:
//
//   TOGO_TEST_SUPABASE_URL / TOGO_TEST_SUPABASE_ANON_KEY   (throwaway project only)
//   TOGO_TEST_PASSENGER_EMAIL / TOGO_TEST_PASSENGER_PASSWORD
//   TOGO_TEST_PASSENGER2_EMAIL / TOGO_TEST_PASSENGER2_PASSWORD  (cross-user checks)
//   TOGO_TEST_CONDUCTOR_EMAIL / TOGO_TEST_CONDUCTOR_PASSWORD    (assigned to TRIP)
//   TOGO_TEST_OTHER_STAFF_EMAIL / TOGO_TEST_OTHER_STAFF_PASSWORD (NOT assigned; may be absent)
//   TOGO_TEST_TRIP_ID / TOGO_TEST_PICKUP_STOP_ID / TOGO_TEST_DROPOFF_STOP_ID
//   TOGO_TEST_COMPLETABLE_TRIP_ID (optional, disposable — enables the destructive
//                                  check-in→complete→missed_pickup flow)
//
// Only the public anon key and per-user passwords are used here — no service-role
// key. Fixtures are isolated with a per-run idempotency prefix and cleaned up.
import { describe, it, expect, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.TOGO_TEST_SUPABASE_URL;
const ANON = process.env.TOGO_TEST_SUPABASE_ANON_KEY;
const P_EMAIL = process.env.TOGO_TEST_PASSENGER_EMAIL;
const P_PASS = process.env.TOGO_TEST_PASSENGER_PASSWORD;
const P2_EMAIL = process.env.TOGO_TEST_PASSENGER2_EMAIL;
const P2_PASS = process.env.TOGO_TEST_PASSENGER2_PASSWORD;
const C_EMAIL = process.env.TOGO_TEST_CONDUCTOR_EMAIL;
const C_PASS = process.env.TOGO_TEST_CONDUCTOR_PASSWORD;
const O_EMAIL = process.env.TOGO_TEST_OTHER_STAFF_EMAIL;
const O_PASS = process.env.TOGO_TEST_OTHER_STAFF_PASSWORD;
const TRIP = process.env.TOGO_TEST_TRIP_ID;
const PICKUP = process.env.TOGO_TEST_PICKUP_STOP_ID;
const DROPOFF = process.env.TOGO_TEST_DROPOFF_STOP_ID;
const COMPLETABLE = process.env.TOGO_TEST_COMPLETABLE_TRIP_ID;

const ready = !!(URL && ANON && P_EMAIL && P_PASS && C_EMAIL && C_PASS && TRIP && PICKUP && DROPOFF);
const suite = ready ? describe : describe.skip;

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

suite('Supabase integration — Auth + PostgREST + RLS + Realtime (2 sessions)', () => {
  const run = Date.now().toString(36);
  const clients: SupabaseClient[] = [];
  const track = (c: SupabaseClient) => { clients.push(c); return c; };

  afterAll(async () => {
    for (const c of clients) { try { await c.auth.signOut(); } catch { /* ignore */ } }
  });

  it('authenticates a passenger and browses trips through PostgREST', async () => {
    const p = track(await signIn(P_EMAIL!, P_PASS!));
    const { data: session } = await p.auth.getSession();
    expect(session.session?.user).toBeTruthy();
    const { data: trips, error } = await p.from('trips_public').select('*').limit(5);
    expect(error).toBeNull();
    expect(Array.isArray(trips)).toBe(true);
  });

  it('reserves; a separate conductor session sees the manifest but not the booking base row', async () => {
    const passenger = track(await signIn(P_EMAIL!, P_PASS!));
    const conductor = track(await signIn(C_EMAIL!, C_PASS!));

    const { data: booking, error: resErr } = await passenger.rpc('reserve_booking', {
      p_trip_id: TRIP, p_pickup_stop_id: PICKUP, p_dropoff_stop_id: DROPOFF,
      p_seats: 1, p_passenger_name: 'Integration Test', p_passenger_phone: null,
      p_idempotency_key: `itest-${run}`,
    });
    expect(resErr).toBeNull();
    const b = booking as { id: string; boarding_credential: string };
    expect(b.id).toBeTruthy();

    try {
      // Idempotent replay returns the same booking.
      const { data: replay } = await passenger.rpc('reserve_booking', {
        p_trip_id: TRIP, p_pickup_stop_id: PICKUP, p_dropoff_stop_id: DROPOFF,
        p_seats: 1, p_passenger_name: 'Integration Test', p_passenger_phone: null,
        p_idempotency_key: `itest-${run}`,
      });
      expect((replay as { id: string }).id).toBe(b.id);

      // Conductor sees it via the manifest RPC (minimal PII, no credential).
      const { data: manifest, error: mErr } = await conductor.rpc('get_trip_manifest', { p_trip_id: TRIP });
      expect(mErr).toBeNull();
      const row = (manifest as Array<{ booking_id: string; passenger_name: string }>).find((r) => r.booking_id === b.id);
      expect(row).toBeTruthy();
      expect(row).not.toHaveProperty('boarding_credential');

      // Conductor cannot read the passenger's booking base row (RLS).
      const { data: leaked } = await conductor.from('bookings').select('*').eq('id', b.id);
      expect((leaked ?? []).length).toBe(0);
    } finally {
      await passenger.rpc('cancel_booking', { p_booking_id: b.id });
    }
  }, 30000);

  it('denies a second passenger access to the first passenger\'s booking (cross-user)', async () => {
    if (!(P2_EMAIL && P2_PASS)) return; // optional
    const passenger = track(await signIn(P_EMAIL!, P_PASS!));
    const other = track(await signIn(P2_EMAIL!, P2_PASS!));
    const { data: booking } = await passenger.rpc('reserve_booking', {
      p_trip_id: TRIP, p_pickup_stop_id: PICKUP, p_dropoff_stop_id: DROPOFF,
      p_seats: 1, p_passenger_name: 'X', p_passenger_phone: null, p_idempotency_key: `itest-x-${run}`,
    });
    const b = booking as { id: string };
    try {
      const { data: seen } = await other.from('bookings').select('*').eq('id', b.id);
      expect((seen ?? []).length).toBe(0);
    } finally {
      await passenger.rpc('cancel_booking', { p_booking_id: b.id });
    }
  }, 30000);

  it('denies staff not assigned to the trip (cross-operator / assignment)', async () => {
    if (!(O_EMAIL && O_PASS)) return; // optional
    const other = track(await signIn(O_EMAIL!, O_PASS!));
    const { error } = await other.rpc('get_trip_manifest', { p_trip_id: TRIP });
    expect(error).toBeTruthy(); // FORBIDDEN
  }, 30000);

  it('delivers a Realtime event to a subscribed passenger when the conductor changes the trip', async () => {
    const passenger = track(await signIn(P_EMAIL!, P_PASS!));
    const conductor = track(await signIn(C_EMAIL!, C_PASS!));

    const got = new Promise<boolean>((resolve) => {
      const ch = passenger
        .channel(`itest-trip-${run}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${TRIP}` },
          () => { resolve(true); passenger.removeChannel(ch); })
        .subscribe();
      setTimeout(() => resolve(false), 12000);
    });
    // A small delay to ensure the subscription is established, then mutate.
    await new Promise((r) => setTimeout(r, 1500));
    await conductor.rpc('report_delay', { p_trip_id: TRIP, p_minutes: 1 });
    expect(await got).toBe(true);
  }, 30000);

  it('handles check-in → complete → missed_pickup on a disposable trip', async () => {
    if (!COMPLETABLE) return; // opt-in; destructive
    const passenger = track(await signIn(P_EMAIL!, P_PASS!));
    const conductor = track(await signIn(C_EMAIL!, C_PASS!));
    // Reserve + check in on the disposable trip's first/last stops.
    const { data: stops } = await passenger.from('trip_stops_public').select('*').eq('trip_id', COMPLETABLE).order('stop_order');
    const ordered = (stops ?? []) as Array<{ id: string }>;
    expect(ordered.length).toBeGreaterThanOrEqual(2);
    const { data: booking } = await passenger.rpc('reserve_booking', {
      p_trip_id: COMPLETABLE, p_pickup_stop_id: ordered[0].id, p_dropoff_stop_id: ordered[ordered.length - 1].id,
      p_seats: 1, p_passenger_name: 'Miss', p_passenger_phone: null, p_idempotency_key: `itest-miss-${run}`,
    });
    const b = booking as { id: string };
    await passenger.rpc('check_in_booking', { p_booking_id: b.id });
    await conductor.rpc('update_trip_status', { p_trip_id: COMPLETABLE, p_status: 'completed' });
    const { data: after } = await passenger.from('bookings').select('status,unresolved').eq('id', b.id).single();
    expect((after as { status: string }).status).toBe('missed_pickup');
    expect((after as { unresolved: boolean }).unresolved).toBe(true);
  }, 45000);

  it('logout clears the session so protected reads no longer return the user\'s rows', async () => {
    const passenger = track(await signIn(P_EMAIL!, P_PASS!));
    await passenger.auth.signOut();
    const { data } = await passenger.from('bookings').select('*');
    expect((data ?? []).length).toBe(0); // no session → anon → RLS yields nothing
  }, 30000);
});
