// Supabase INTEGRATION tests — exercise the real GoTrue (Auth) + PostgREST (RPC)
// + RLS path with two separate authenticated sessions (a passenger and a
// conductor). These are NOT run by `npm test`; run them explicitly with:
//
//   npm run test:integration
//
// They are SKIPPED unless an explicitly-designated test environment is provided,
// so they can never run against an arbitrary/production database:
//
//   TOGO_TEST_SUPABASE_URL         (a throwaway/test project only)
//   TOGO_TEST_SUPABASE_ANON_KEY
//   TOGO_TEST_PASSENGER_EMAIL / TOGO_TEST_PASSENGER_PASSWORD
//   TOGO_TEST_CONDUCTOR_EMAIL / TOGO_TEST_CONDUCTOR_PASSWORD
//   TOGO_TEST_TRIP_ID              (a trip the conductor is assigned to)
//   TOGO_TEST_PICKUP_STOP_ID / TOGO_TEST_DROPOFF_STOP_ID
//
// Fixtures are isolated per run via a unique idempotency prefix, and the passenger
// booking created by the test is cancelled in teardown. Do NOT point these at a
// database holding real passenger data.
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.TOGO_TEST_SUPABASE_URL;
const ANON = process.env.TOGO_TEST_SUPABASE_ANON_KEY;
const P_EMAIL = process.env.TOGO_TEST_PASSENGER_EMAIL;
const P_PASS = process.env.TOGO_TEST_PASSENGER_PASSWORD;
const C_EMAIL = process.env.TOGO_TEST_CONDUCTOR_EMAIL;
const C_PASS = process.env.TOGO_TEST_CONDUCTOR_PASSWORD;
const TRIP = process.env.TOGO_TEST_TRIP_ID;
const PICKUP = process.env.TOGO_TEST_PICKUP_STOP_ID;
const DROPOFF = process.env.TOGO_TEST_DROPOFF_STOP_ID;

const ready = !!(URL && ANON && P_EMAIL && P_PASS && C_EMAIL && C_PASS && TRIP && PICKUP && DROPOFF);

// describe.skip when the designated test environment is absent — clearly UNEXECUTED.
const suite = ready ? describe : describe.skip;

suite('Supabase integration (Auth + PostgREST + RLS, two sessions)', () => {
  const run = Date.now().toString(36);

  async function signedIn(email: string, password: string) {
    const c = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return c;
  }

  it('passenger reserves via RPC; conductor sees the manifest but not the passenger base row', async () => {
    const passenger = await signedIn(P_EMAIL!, P_PASS!);
    const conductor = await signedIn(C_EMAIL!, C_PASS!);

    // Passenger reserves through the secured function.
    const { data: booking, error: resErr } = await passenger.rpc('reserve_booking', {
      p_trip_id: TRIP, p_pickup_stop_id: PICKUP, p_dropoff_stop_id: DROPOFF,
      p_seats: 1, p_passenger_name: 'Integration Test', p_passenger_phone: null,
      p_idempotency_key: `itest-${run}`,
    });
    expect(resErr).toBeNull();
    expect(booking).toBeTruthy();
    const bookingId = (booking as { id: string }).id;

    try {
      // Conductor can read the manifest via the RPC (minimal PII, no credential).
      const { data: manifest, error: mErr } = await conductor.rpc('get_trip_manifest', { p_trip_id: TRIP });
      expect(mErr).toBeNull();
      expect(Array.isArray(manifest)).toBe(true);
      const row = (manifest as Array<{ booking_id: string }>).find((r) => r.booking_id === bookingId);
      expect(row).toBeTruthy();

      // Conductor must NOT be able to read the passenger's booking base row (RLS).
      const { data: leaked } = await conductor.from('bookings').select('*').eq('id', bookingId);
      expect((leaked ?? []).length).toBe(0);
    } finally {
      // Isolate fixtures: release the seat we created.
      await passenger.rpc('cancel_booking', { p_booking_id: bookingId });
      await passenger.auth.signOut();
      await conductor.auth.signOut();
    }
  }, 30000);
});
