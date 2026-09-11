import { describe, it, expect, beforeEach } from 'vitest';
import { SupabaseAdapter } from './supabaseAdapter';
import type { SupabaseClient } from '@supabase/supabase-js';

// A tiny fake Supabase client that records rpc calls and returns canned data, so we
// can assert the adapter's CONTRACT (which RPC/args it uses, how it maps rows) without
// a live backend. The query builder is awaitable and resolves per-table canned rows.
function makeFake(opts: {
  rpc?: Record<string, unknown>;
  tables?: Record<string, unknown[]>;
}) {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const fromCalls: string[] = [];
  const client = {
    rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: opts.rpc?.[fn] ?? null, error: null });
    },
    from(table: string) {
      fromCalls.push(table);
      const rows = opts.tables?.[table] ?? [];
      const builder: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'order', 'limit']) {
        builder[m] = () => builder;
      }
      builder.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
      // Awaiting the builder resolves the list result.
      builder.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: rows, error: null });
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, rpcCalls, fromCalls };
}

describe('SupabaseAdapter staff contract', () => {
  let fake: ReturnType<typeof makeFake>;

  beforeEach(() => {
    fake = makeFake({
      rpc: {
        my_staff_workspaces: [
          { role: 'conductor', operator_id: 'op1', operator_name: 'Savannah', hub_id: null, hub_name: null, assigned_trip_count: 2, staff_name: 'Grace' },
          { role: 'attendant', operator_id: null, operator_name: null, hub_id: 'hubK', hub_name: 'Nakawa Green Hub', assigned_trip_count: 0, staff_name: 'Peter' },
        ],
        my_assigned_trip_ids: ['t1'],
        get_hub_incidents: [
          { booking_id: 'b1', reference: 'TG-1', passenger_name: 'A', seats: 2, status: 'missed_pickup', trip_id: 't9', pickup_time: '2026-01-01T00:00:00Z' },
        ],
        resolve_boarding: {
          id: 'b1', trip_id: 't1', reference: 'TG-1', boarding_credential: 'cred', seats: 1,
          status: 'checked_in', payment_status: 'pay_at_boarding', fare_ugx_snapshot: 25000,
          pickup_hub_id: 'hubK', dropoff_hub_id: 'hubM', pickup_time_snapshot: 'x', dropoff_time_snapshot: 'y',
          passenger_name: 'A', unresolved: false, created_at: 'z',
        },
      },
      tables: {
        trips_public: [{ id: 't1', operator_id: 'op1', operator_name: 'Savannah', direction: 'KLA_MBR', service_date: '2026-01-01', origin_departure: 'x', destination_arrival: 'y', fare_ugx: 25000, capacity: 33, status: 'scheduled', delay_minutes: 0, progress: 0, last_update: 'z', seats_reserved: 0, seats_available: 33 }],
        trip_stops_public: [{ id: 's1', trip_id: 't1', hub_id: 'hubK', hub_name: 'Nakawa', hub_city: 'Kampala', stop_order: 0, pickup_time: 'x', reached: false }],
      },
    });
  });

  it('listStaff maps the caller’s own workspaces to StaffViews with synthetic ids', async () => {
    const a = new SupabaseAdapter(fake.client);
    const staff = await a.listStaff();
    expect(fake.rpcCalls.map((c) => c.fn)).toContain('my_staff_workspaces');
    const con = staff.find((s) => s.role === 'conductor')!;
    expect(con.id).toBe('self:conductor');
    expect(con.assignedTripCount).toBe(2);
    expect(con.operatorName).toBe('Savannah');
    const att = staff.find((s) => s.role === 'attendant')!;
    expect(att.id).toBe('self:attendant:hubK');
    expect(att.assignedHubId).toBe('hubK');
  });

  it('staffTrips resolves ids via my_assigned_trip_ids then reads trips_public', async () => {
    const a = new SupabaseAdapter(fake.client);
    const trips = await a.staffTrips('self:conductor');
    const call = fake.rpcCalls.find((c) => c.fn === 'my_assigned_trip_ids');
    expect(call?.args.p_role).toBe('conductor');
    expect(fake.fromCalls).toContain('trips_public');
    expect(trips[0].id).toBe('t1');
    expect(trips[0].stops[0].hubId).toBe('hubK');
  });

  it('staffTrips requests the driver role for a driver workspace id', async () => {
    const a = new SupabaseAdapter(fake.client);
    await a.staffTrips('self:driver');
    expect(fake.rpcCalls.find((c) => c.fn === 'my_assigned_trip_ids')?.args.p_role).toBe('driver');
  });

  it('attendantHubId reads the hub from the workspace id with no server round-trip', async () => {
    const a = new SupabaseAdapter(fake.client);
    const hub = await a.attendantHubId('self:attendant:hubK');
    expect(hub).toBe('hubK');
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it('hubIncidents maps get_hub_incidents rows', async () => {
    const a = new SupabaseAdapter(fake.client);
    const rows = await a.hubIncidents('hubK');
    expect(fake.rpcCalls[0].fn).toBe('get_hub_incidents');
    expect(rows[0].reference).toBe('TG-1');
    expect(rows[0].status).toBe('missed_pickup');
  });

  it('resolveBoarding calls resolve_boarding (never board_booking) and strips a TOGO: prefix', async () => {
    const a = new SupabaseAdapter(fake.client);
    const b = await a.resolveBoarding('t1', 'TOGO:cred');
    expect(fake.rpcCalls.map((c) => c.fn)).toContain('resolve_boarding');
    expect(fake.rpcCalls.map((c) => c.fn)).not.toContain('board_booking');
    const call = fake.rpcCalls.find((c) => c.fn === 'resolve_boarding')!;
    expect(call.args.p_credential).toBe('cred'); // prefix stripped
    expect(b.status).toBe('checked_in'); // returned as-is, NOT boarded
    expect(b.reference).toBe('TG-1');
  });
});
