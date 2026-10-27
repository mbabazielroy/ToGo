import type { HubView, ManifestRow, TripView, LocationView } from '@shared/data/adapter';
import { tripGeometry, estimateBus, type LatLng } from '@shared/data/geo';
import { lineFor } from '../../lib/lines';
import type { MapBus, MapRoute, MapStop } from './types';

/** Passengers still to collect at each stop (seats), and how many have checked in. */
export interface StopPickup { hubId: string; toPickUp: number; checkedIn: number; boarded: number }

export function pickupsByStop(rows: ManifestRow[]): Map<string, StopPickup> {
  const map = new Map<string, StopPickup>();
  for (const r of rows) {
    const cur = map.get(r.pickupHubId) ?? { hubId: r.pickupHubId, toPickUp: 0, checkedIn: 0, boarded: 0 };
    if (r.status === 'reserved' || r.status === 'checked_in') cur.toPickUp += r.seats;
    if (r.status === 'checked_in') cur.checkedIn += r.seats;
    if (r.status === 'boarded' || r.status === 'completed') cur.boarded += r.seats;
    map.set(r.pickupHubId, cur);
  }
  return map;
}

export interface TripMapData {
  routes: MapRoute[];
  stops: MapStop[];
  buses: MapBus[];
  caption: string;
  /** Where the camera should focus (city leg while picking up, whole corridor after). */
  focus: LatLng[];
  live: boolean;
}

/**
 * Everything a TransitMap needs for one trip. `highlightHubId` marks the
 * passenger's own stop; `pickups` adds per-stop counts (driver view).
 */
export function tripMapData(
  trip: TripView,
  hubs: HubView[],
  now: Date,
  opts: { highlightHubId?: string | null; pickups?: Map<string, StopPickup>; fix?: LocationView | null; demo?: boolean } = {},
): TripMapData {
  const line = lineFor(trip.operatorId, trip.operatorName);
  const geo = tripGeometry(trip, hubs);
  const ordered = [...trip.stops].sort((a, b) => a.stopOrder - b.stopOrder);
  const next = ordered.find((s) => !s.reached);
  const stops: MapStop[] = ordered.flatMap((s, i) => {
    const coord = geo.stops[i];
    if (!coord) return [];
    return [{
      id: s.hubId,
      coord,
      label: s.hubName,
      color: line.color,
      passed: s.reached,
      highlight: opts.highlightHubId ? s.hubId === opts.highlightHubId : s === next && (trip.status === 'en_route' || trip.status === 'boarding'),
      badge: opts.pickups ? opts.pickups.get(s.hubId)?.toPickUp ?? 0 : undefined,
    }];
  });
  const bus = estimateBus(trip, geo, now, opts.fix ? { lat: opts.fix.lat, lng: opts.fix.lng } : null);
  const buses: MapBus[] = bus ? [{ id: trip.id, coord: bus.position, color: line.color, label: line.code, estimate: bus.source === 'estimate' }] : [];

  const running = trip.status === 'en_route' || trip.status === 'boarding';
  const caption = trip.status === 'cancelled'
    ? 'Cancelled'
    : trip.status === 'completed'
      ? 'Arrived'
      : !running
        ? 'Not departed yet'
        : bus?.source === 'gps'
          ? 'Live GPS'
          : opts.demo ? 'Estimated position · preview' : 'Estimated from schedule';

  // While collecting passengers, frame the city stops + bus; once on the highway, the corridor.
  const cityPoints = [...stops.map((s) => s.coord), ...buses.map((b) => b.coord)];
  const onHighway = !next;
  const focus = onHighway || cityPoints.length < 2 ? geo.path : cityPoints;

  return {
    routes: [{ id: trip.id, path: geo.path, color: line.color }],
    stops,
    buses,
    caption,
    focus,
    live: running,
  };
}
