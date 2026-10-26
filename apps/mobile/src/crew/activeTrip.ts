import type { TripView } from '@shared/data/adapter';

/** The trip a crew member is working on: the one they picked, else the first that
 *  is still running or upcoming, else their first trip of the day. */
export function pickActiveTrip(trips: TripView[], selectedId?: string): TripView | undefined {
  return trips.find((t) => t.id === selectedId)
    ?? trips.find((t) => t.status === 'boarding' || t.status === 'en_route')
    ?? trips.find((t) => t.status === 'scheduled')
    ?? trips[0];
}
