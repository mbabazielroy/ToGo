// Single source of truth for a passenger journey's endpoints, shared by web and
// mobile so search, review, the persisted booking, and the boarding pass agree.
//
// IMPORTANT: a trip's `stops` are PICKUP hubs in the ORIGIN city only. The journey's
// destination is the end of the corridor (a different city) arriving at
// `trip.destinationArrival` — it is NOT the last pickup stop. Presenting the last
// pickup hub as the arrival (e.g. "Natete Junction Stop, Kampala" for a
// Kampala → Mbarara trip) is the bug this module exists to prevent.

import type { TripView, TripStopView } from './adapter';
import { DIRECTION_CITIES } from '../lib/lookup';

export interface JourneyEndpoints {
  /** The selected pickup stop (or the first stop when none is chosen). */
  pickup: TripStopView | undefined;
  originCity: string;
  /** Corridor endpoint city — never an origin pickup hub. */
  destinationCity: string;
  /** Pickup time at the selected hub (falls back to origin departure). */
  pickupTimeISO: string;
  /** True journey arrival — the trip's destination arrival. */
  arrivalTimeISO: string;
}

function orderedStops(trip: TripView): TripStopView[] {
  return [...trip.stops].sort((a, b) => a.stopOrder - b.stopOrder);
}

export function tripJourney(trip: TripView, preferredHubId?: string | null): JourneyEndpoints {
  const stops = orderedStops(trip);
  const pickup = (preferredHubId ? stops.find((s) => s.hubId === preferredHubId) : undefined) ?? stops[0];
  const cities = DIRECTION_CITIES[trip.direction];
  return {
    pickup,
    originCity: cities.origin,
    destinationCity: cities.destination,
    pickupTimeISO: pickup ? pickup.pickupTime : trip.originDeparture,
    arrivalTimeISO: trip.destinationArrival,
  };
}

/**
 * The stop id to send as the reservation's dropoff. It is the LAST stop in order.
 * Demo mode ignores it (the destination is the corridor endpoint); connected mode
 * validates pickup.order < dropoff.order. This is only the reservation argument — it
 * must never be used to LABEL the arrival (use `tripJourney().destinationCity` and
 * `arrivalTimeISO` for that).
 */
export function dropoffStopFor(trip: TripView): TripStopView | undefined {
  const stops = orderedStops(trip);
  return stops[stops.length - 1];
}
