import { describe, it, expect } from 'vitest';
import { DemoAdapter } from './demoAdapter';
import { buildSeedState } from './seed';
import { tripGeometry, estimateBus, along, CITY_CENTRE, distanceKm, formatDistance, isFreshFix, LIVE_FIX_MAX_AGE_MS } from './geo';

const TODAY = '2026-09-11';

async function setup() {
  const a = DemoAdapter.withState(buildSeedState(TODAY));
  const hubs = await a.listHubs();
  const [trip] = await a.searchTrips({ direction: 'KLA_MBR', date: TODAY });
  return { a, hubs, trip };
}

describe('map geometry', () => {
  it('draws pickup hubs in order, then the road, ending in the destination city', async () => {
    const { hubs, trip } = await setup();
    const g = tripGeometry(trip, hubs);
    expect(g.stops.every(Boolean)).toBe(true);
    expect(g.path[0]).toEqual(g.stops[0]);
    expect(g.path[g.path.length - 1]).toEqual(CITY_CENTRE.Mbarara);
  });

  it('has no bus on the map before departure', async () => {
    const { hubs, trip } = await setup();
    expect(estimateBus(trip, tripGeometry(trip, hubs), new Date(trip.originDeparture))).toBeNull();
  });

  it('never moves the bus past a hub the crew has not reached yet', async () => {
    const { a, hubs, trip } = await setup();
    const started = await a.updateTripStatus(trip.id, 'en_route'); // marks the first hub reached
    const g = tripGeometry(started, hubs);
    const late = new Date(new Date(started.destinationArrival).getTime() - 60000); // schedule says nearly there
    const bus = estimateBus(started, g, late)!;
    expect(bus.source).toBe('estimate');
    expect(bus.position).toEqual(g.stops[1]); // held at the next unreached hub
  });

  it('uses a GPS fix when one is available', async () => {
    const { a, hubs, trip } = await setup();
    const started = await a.updateTripStatus(trip.id, 'en_route');
    const bus = estimateBus(started, tripGeometry(started, hubs), new Date(), { lat: 0.1, lng: 32 })!;
    expect(bus.source).toBe('gps');
    expect(bus.position).toEqual({ latitude: 0.1, longitude: 32 });
  });

  it('interpolates along a polyline', () => {
    const p = along([{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 2 }], 0.5);
    expect(p.longitude).toBeCloseTo(1);
  });
});

describe('distances and live fixes', () => {
  it('measures straight-line distance', () => {
    // Kampala to Mbarara centres are about 240 km apart as the crow flies.
    const d = distanceKm(CITY_CENTRE.Kampala, CITY_CENTRE.Mbarara);
    expect(d).toBeGreaterThan(220);
    expect(d).toBeLessThan(260);
    expect(distanceKm(CITY_CENTRE.Kampala, CITY_CENTRE.Kampala)).toBe(0);
  });

  it('formats distances for people walking', () => {
    expect(formatDistance(0.004)).toBe('10 m');
    expect(formatDistance(0.846)).toBe('850 m');
    expect(formatDistance(3.24)).toBe('3.2 km');
    expect(formatDistance(42.6)).toBe('43 km');
  });

  it('treats a fix as live for a few minutes only', () => {
    const now = new Date('2026-09-11T05:30:00Z');
    const at = (msAgo: number) => ({ receivedAt: new Date(now.getTime() - msAgo).toISOString() });
    expect(isFreshFix(at(30000), now)).toBe(true);
    expect(isFreshFix(at(LIVE_FIX_MAX_AGE_MS + 1000), now)).toBe(false);
    expect(isFreshFix(null, now)).toBe(false);
  });
});
