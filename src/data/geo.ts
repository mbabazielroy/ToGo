// Map geometry for the Kampala ⇄ Mbarara corridor, shared by web and mobile.
//
// Positions are APPROXIMATE (town centres along the Kampala–Masaka–Mbarara road)
// and good enough for an overview map, not for navigation. When a real GPS fix is
// available (connected mode, LocationView), that is used instead of the estimate.

import type { HubView, TripView } from './adapter';

export interface LatLng { latitude: number; longitude: number }

/** Road waypoints from Kampala to Mbarara (reverse for the other direction). */
const CORRIDOR_KLA_MBR: LatLng[] = [
  { latitude: 0.3000, longitude: 32.5200 }, // Busega
  { latitude: 0.2620, longitude: 32.4580 }, // Nsangi
  { latitude: 0.2260, longitude: 32.3130 }, // Mpigi
  { latitude: 0.0560, longitude: 32.0950 }, // Buwama
  { latitude: -0.1530, longitude: 31.8740 }, // Lukaya
  { latitude: -0.3330, longitude: 31.7340 }, // Masaka
  { latitude: -0.4030, longitude: 31.1580 }, // Lyantonde
  { latitude: -0.5120, longitude: 30.9340 }, // Sanga
];

export const CITY_CENTRE: Record<string, LatLng> = {
  Kampala: { latitude: 0.3150, longitude: 32.5820 },
  Mbarara: { latitude: -0.6075, longitude: 30.6560 },
};

export const CORRIDOR_REGION = { latitude: -0.15, longitude: 31.6, latitudeDelta: 1.35, longitudeDelta: 2.4 };

export function hubPoint(h: Pick<HubView, 'lat' | 'lng'> | undefined): LatLng | null {
  if (!h || h.lat == null || h.lng == null) return null;
  return { latitude: h.lat, longitude: h.lng };
}

export interface TripGeometry {
  /** Full drawn line: pickup hubs in order, then the road, then the destination. */
  path: LatLng[];
  /** Pickup stop positions, in stop order (null when a hub has no coordinates). */
  stops: (LatLng | null)[];
  destination: LatLng;
}

export function tripGeometry(trip: TripView, hubs: HubView[]): TripGeometry {
  const byId = new Map(hubs.map((h) => [h.id, h]));
  const ordered = [...trip.stops].sort((a, b) => a.stopOrder - b.stopOrder);
  const stops = ordered.map((s) => hubPoint(byId.get(s.hubId)));
  const road = trip.direction === 'KLA_MBR' ? CORRIDOR_KLA_MBR : [...CORRIDOR_KLA_MBR].reverse();
  const destination = CITY_CENTRE[trip.direction === 'KLA_MBR' ? 'Mbarara' : 'Kampala'];
  const path = [...stops.filter((p): p is LatLng => !!p), ...road, destination];
  return { path, stops, destination };
}

function dist(a: LatLng, b: LatLng): number {
  const dx = (a.longitude - b.longitude) * Math.cos(((a.latitude + b.latitude) / 2) * (Math.PI / 180));
  const dy = a.latitude - b.latitude;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Point a fraction (0..1) of the way along a polyline. */
export function along(path: LatLng[], fraction: number): LatLng {
  if (path.length === 0) return CITY_CENTRE.Kampala;
  if (path.length === 1 || fraction <= 0) return path[0];
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) { const d = dist(path[i - 1], path[i]); seg.push(d); total += d; }
  let target = Math.min(1, fraction) * total;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const t = seg[i] === 0 ? 0 : Math.min(1, target / seg[i]);
      return {
        latitude: path[i].latitude + (path[i + 1].latitude - path[i].latitude) * t,
        longitude: path[i].longitude + (path[i + 1].longitude - path[i].longitude) * t,
      };
    }
    target -= seg[i];
  }
  return path[path.length - 1];
}

export interface BusEstimate {
  position: LatLng;
  /** 0..1 along the drawn path. */
  fraction: number;
  /** 'gps' when from a real fix, 'estimate' when interpolated from the schedule. */
  source: 'gps' | 'estimate';
}

/**
 * Where the bus is now. Uses a GPS fix when given; otherwise estimates from the
 * schedule (and delay) between departure and arrival, never behind the last hub
 * the crew marked reached. Returns null when the bus isn't on the road.
 */
export function estimateBus(
  trip: TripView,
  geo: TripGeometry,
  now: Date,
  fix?: { lat: number; lng: number } | null,
): BusEstimate | null {
  if (trip.status === 'cancelled') return null;
  if (fix) return { position: { latitude: fix.lat, longitude: fix.lng }, fraction: NaN, source: 'gps' };
  if (trip.status === 'completed') return { position: geo.destination, fraction: 1, source: 'estimate' };
  if (trip.status !== 'en_route' && trip.status !== 'boarding') return null;

  const start = new Date(trip.originDeparture).getTime() + trip.delayMinutes * 60000;
  const end = new Date(trip.destinationArrival).getTime();
  const byTime = end > start ? (now.getTime() - start) / (end - start) : 0;

  // Fraction of the path at which each stop sits, to respect "reached" marks.
  const stopFractions: number[] = [];
  const pts = geo.path;
  let total = 0;
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) { total += dist(pts[i - 1], pts[i]); cum.push(total); }
  const known = geo.stops.filter((p): p is LatLng => !!p);
  known.forEach((_, i) => stopFractions.push(total ? cum[i] / total : 0));
  const ordered = [...trip.stops].sort((a, b) => a.stopOrder - b.stopOrder);
  const lastReached = ordered.reduce((acc, s, i) => (s.reached ? i : acc), -1);
  const nextUnreached = ordered.findIndex((s) => !s.reached);
  const floor = lastReached >= 0 ? stopFractions[Math.min(lastReached, stopFractions.length - 1)] ?? 0 : 0;
  // Don't run past a hub the crew hasn't marked reached yet.
  const ceiling = nextUnreached >= 0 ? stopFractions[Math.min(nextUnreached, stopFractions.length - 1)] ?? 1 : 1;
  const fraction = Math.max(floor, Math.min(ceiling, Math.max(0, Math.min(0.98, byTime))));
  return { position: along(pts, fraction), fraction, source: 'estimate' };
}

/** A region that fits every point with some padding. */
export function regionFor(points: LatLng[]) {
  if (points.length === 0) return CORRIDOR_REGION;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.4),
  };
}
