import { describe, it, expect } from 'vitest';
import { buildSeedState } from './seed';
import { DemoAdapter } from './demoAdapter';
import { tripJourney, dropoffStopFor } from './journey';
import type { TripView } from './adapter';

const TODAY = '2026-09-10';

function makeAdapter() {
  return DemoAdapter.withState(buildSeedState(TODAY));
}
async function firstKlaMbrTrip(a: DemoAdapter): Promise<TripView> {
  const trips = await a.searchTrips({ direction: 'KLA_MBR', date: TODAY });
  return trips[0];
}

describe('journey endpoints — destination is the corridor city, not the last pickup hub', () => {
  it('maps a Kampala → Mbarara trip to Mbarara arriving at destinationArrival', async () => {
    const a = makeAdapter();
    const trip = await firstKlaMbrTrip(a);

    // Guard the actual bug: the last PICKUP stop is a Kampala hub. It must never be
    // used as the arrival point of a Kampala → Mbarara journey.
    const stops = [...trip.stops].sort((x, y) => x.stopOrder - y.stopOrder);
    const lastStop = stops[stops.length - 1];
    expect(lastStop.hubCity).toBe('Kampala');

    const j = tripJourney(trip, null);
    expect(j.originCity).toBe('Kampala');
    expect(j.destinationCity).toBe('Mbarara');
    expect(j.destinationCity).not.toBe(lastStop.hubCity);
    // Arrival is the trip's destination arrival, not any pickup-stop time.
    expect(j.arrivalTimeISO).toBe(trip.destinationArrival);
    expect(j.arrivalTimeISO).not.toBe(lastStop.pickupTime);
  });

  it('honours the selected pickup hub and keeps arrival at the destination', async () => {
    const a = makeAdapter();
    const trip = await firstKlaMbrTrip(a);
    const ndeeba = trip.stops.find((s) => s.hubName.includes('Ndeeba'))!;

    const j = tripJourney(trip, ndeeba.hubId);
    expect(j.pickup!.hubId).toBe(ndeeba.hubId);
    expect(j.pickupTimeISO).toBe(ndeeba.pickupTime);
    expect(j.arrivalTimeISO).toBe(trip.destinationArrival);
  });

  it('reversed direction (Mbarara → Kampala) resolves to Kampala', async () => {
    const a = makeAdapter();
    const trips = await a.searchTrips({ direction: 'MBR_KLA', date: TODAY });
    const j = tripJourney(trips[0], null);
    expect(j.originCity).toBe('Mbarara');
    expect(j.destinationCity).toBe('Kampala');
    expect(j.arrivalTimeISO).toBe(trips[0].destinationArrival);
  });

  it('persisted booking agrees: pickup time = selected stop, arrival = destination arrival', async () => {
    const a = makeAdapter();
    const trip = await firstKlaMbrTrip(a);
    const pickup = trip.stops[0];
    const dropoff = dropoffStopFor(trip)!;

    const booking = await a.reserve({
      tripId: trip.id,
      pickupStopId: pickup.id,
      dropoffStopId: dropoff.id,
      seats: 1,
      passengerName: 'Amina',
      idempotencyKey: 'jrn-1',
    });

    // The persisted snapshot must match what search/review showed.
    expect(booking.pickupTimeSnapshot).toBe(pickup.pickupTime);
    expect(booking.dropoffTimeSnapshot).toBe(trip.destinationArrival);
    // And the arrival snapshot is not a Kampala pickup-hub time.
    const lastStop = [...trip.stops].sort((x, y) => x.stopOrder - y.stopOrder).slice(-1)[0];
    expect(booking.dropoffTimeSnapshot).not.toBe(lastStop.pickupTime);
  });
});
