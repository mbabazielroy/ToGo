import type {
  AppState,
  Hub,
  Operator,
  Route,
  Trip,
  TripStop,
  Vehicle,
  Direction,
  StaffMember,
} from '../types';
import { addDays, kampalaToday, kampalaDateTime, minutesBetween } from '../lib/time';

export const STORAGE_VERSION = 4;

// ---------------------------------------------------------------------------
// Hubs — illustrative pickup locations. NOT officially approved or partnered.
// ---------------------------------------------------------------------------
export const HUBS: Hub[] = [
  {
    id: 'hub_kla_nakawa',
    name: 'Nakawa Green Hub',
    city: 'Kampala',
    area: 'Near Nakawa, off Jinja Road (demo location)',
    arrivalInstructions:
      'Look for the ToGo lime signpost by the covered waiting bay. Arrive 15 minutes before pickup.',
    openingHours: '05:00 – 21:00 daily',
    facilities: { shelter: true, seating: true, toilets: true, attendant: true, water: true, lighting: true },
  },
  {
    id: 'hub_kla_ndeeba',
    name: 'Ndeeba Roadside Point',
    city: 'Kampala',
    area: 'Ndeeba, along Masaka Road (demo location)',
    arrivalInstructions:
      'Wait at the marked shelter beside the fuel station. An attendant is on duty at busy times.',
    openingHours: '05:30 – 20:00 daily',
    facilities: { shelter: true, seating: true, toilets: false, attendant: true, water: false, lighting: true },
  },
  {
    id: 'hub_kla_natete',
    name: 'Natete Junction Stop',
    city: 'Kampala',
    area: 'Natete, near the taxi junction (demo location)',
    arrivalInstructions: 'Stand under the ToGo shelter on the western side of the junction.',
    openingHours: '05:30 – 20:00 daily',
    facilities: { shelter: true, seating: false, toilets: false, attendant: false, water: false, lighting: true },
  },
  {
    id: 'hub_mbr_central',
    name: 'Mbarara Central Hub',
    city: 'Mbarara',
    area: 'Central Mbarara, near High Street (demo location)',
    arrivalInstructions:
      'The hub is the covered bay with lime ToGo branding. Attendant on duty during opening hours.',
    openingHours: '05:00 – 21:00 daily',
    facilities: { shelter: true, seating: true, toilets: true, attendant: true, water: true, lighting: true },
  },
  {
    id: 'hub_mbr_kakoba',
    name: 'Kakoba Roadside Point',
    city: 'Mbarara',
    area: 'Kakoba, along the Kabale Road (demo location)',
    arrivalInstructions: 'Wait at the marked ToGo shelter near the roundabout.',
    openingHours: '05:30 – 20:00 daily',
    facilities: { shelter: true, seating: true, toilets: false, attendant: true, water: false, lighting: true },
  },
];

// ---------------------------------------------------------------------------
// Operators / vehicles — all fictional.
// ---------------------------------------------------------------------------
export const OPERATORS: Operator[] = [
  { id: 'op_savannah', name: 'Savannah Coaches', rating: 4.6 },
  { id: 'op_pearl', name: 'Pearl Express', rating: 4.4 },
  { id: 'op_ankole', name: 'Ankole Movers', rating: 4.2 },
];

export const VEHICLES: Vehicle[] = [
  { id: 'veh_sav1', operatorId: 'op_savannah', label: 'Coaster 33-seat', plate: 'UAX 100T (demo)', seats: 33 },
  { id: 'veh_sav2', operatorId: 'op_savannah', label: 'Minibus 28-seat', plate: 'UAX 220T (demo)', seats: 28 },
  { id: 'veh_pearl1', operatorId: 'op_pearl', label: 'Coach 45-seat', plate: 'UBG 305T (demo)', seats: 45 },
  { id: 'veh_ankole1', operatorId: 'op_ankole', label: 'Coaster 30-seat', plate: 'UBK 412T (demo)', seats: 30 },
];

// ---------------------------------------------------------------------------
// Routes — Kampala <-> Mbarara, with ordered pickup hub sequences.
// ---------------------------------------------------------------------------
export const ROUTES: Route[] = [
  {
    id: 'route_kla_mbr',
    direction: 'KLA_MBR',
    originCity: 'Kampala',
    destinationCity: 'Mbarara',
    hubSequence: ['hub_kla_nakawa', 'hub_kla_ndeeba', 'hub_kla_natete'],
  },
  {
    id: 'route_mbr_kla',
    direction: 'MBR_KLA',
    originCity: 'Mbarara',
    destinationCity: 'Kampala',
    hubSequence: ['hub_mbr_central', 'hub_mbr_kakoba'],
  },
];

// Minutes after origin departure that each hub in the sequence is reached.
const HUB_PICKUP_OFFSETS: Record<string, number> = {
  hub_kla_nakawa: 0,
  hub_kla_ndeeba: 20,
  hub_kla_natete: 35,
  hub_mbr_central: 0,
  hub_mbr_kakoba: 15,
};

interface TripTemplate {
  id: string;
  routeId: string;
  direction: Direction;
  operatorId: string;
  vehicleId: string;
  departHour: number;
  departMin: number;
  durationMin: number;
  fare: number;
  capacity: number;
  /** Day offsets from "today" in Kampala to schedule this template. */
  dayOffsets: number[];
}

const TRIP_TEMPLATES: TripTemplate[] = [
  // Kampala -> Mbarara
  { id: 'sav_am', routeId: 'route_kla_mbr', direction: 'KLA_MBR', operatorId: 'op_savannah', vehicleId: 'veh_sav1', departHour: 7, departMin: 0, durationMin: 240, fare: 25000, capacity: 33, dayOffsets: [0, 1, 2] },
  { id: 'pearl_mid', routeId: 'route_kla_mbr', direction: 'KLA_MBR', operatorId: 'op_pearl', vehicleId: 'veh_pearl1', departHour: 10, departMin: 30, durationMin: 255, fare: 30000, capacity: 45, dayOffsets: [0, 1, 2] },
  { id: 'ankole_pm', routeId: 'route_kla_mbr', direction: 'KLA_MBR', operatorId: 'op_ankole', vehicleId: 'veh_ankole1', departHour: 15, departMin: 0, durationMin: 250, fare: 22000, capacity: 30, dayOffsets: [0, 1, 2] },
  // Mbarara -> Kampala
  { id: 'sav_mbr_am', routeId: 'route_mbr_kla', direction: 'MBR_KLA', operatorId: 'op_savannah', vehicleId: 'veh_sav2', departHour: 7, departMin: 30, durationMin: 245, fare: 25000, capacity: 28, dayOffsets: [0, 1, 2] },
  { id: 'pearl_mbr_mid', routeId: 'route_mbr_kla', direction: 'MBR_KLA', operatorId: 'op_pearl', vehicleId: 'veh_pearl1', departHour: 12, departMin: 0, durationMin: 255, fare: 30000, capacity: 45, dayOffsets: [0, 1, 2] },
  { id: 'ankole_mbr_pm', routeId: 'route_mbr_kla', direction: 'MBR_KLA', operatorId: 'op_ankole', vehicleId: 'veh_ankole1', departHour: 16, departMin: 30, durationMin: 250, fare: 22000, capacity: 30, dayOffsets: [0, 1] },
];

export function buildStops(routeId: string, originDeparture: string): TripStop[] {
  const route = ROUTES.find((r) => r.id === routeId)!;
  return route.hubSequence.map((hubId, i) => ({
    hubId,
    order: i,
    pickupTime: new Date(
      new Date(originDeparture).getTime() + (HUB_PICKUP_OFFSETS[hubId] ?? 0) * 60000,
    ).toISOString(),
    reached: false,
  }));
}

export function buildSeedTrips(todayISO: string = kampalaToday()): Trip[] {
  const trips: Trip[] = [];
  for (const t of TRIP_TEMPLATES) {
    for (const offset of t.dayOffsets) {
      const date = addDays(todayISO, offset);
      const originDeparture = kampalaDateTime(date, t.departHour, t.departMin);
      const destinationArrival = new Date(
        new Date(originDeparture).getTime() + t.durationMin * 60000,
      ).toISOString();
      const stops = buildStops(t.routeId, originDeparture);
      trips.push({
        id: `trip_${t.id}_${date}`,
        routeId: t.routeId,
        operatorId: t.operatorId,
        vehicleId: t.vehicleId,
        direction: t.direction,
        date,
        originDeparture: new Date(originDeparture).toISOString(),
        destinationArrival,
        farePerSeat: t.fare,
        capacity: t.capacity,
        status: 'scheduled',
        delayMinutes: 0,
        stops,
        progress: 0,
        lastUpdate: new Date().toISOString(),
      });
    }
  }
  return trips;
}

// ---------------------------------------------------------------------------
// Fictional staff for preview persona switching. A driver + conductor per operator
// (assigned that operator's trips today) and one attendant per city's main hub.
// Preview assignment mirrors what a real backend grants via verified records; it
// confers no backend permission.
// ---------------------------------------------------------------------------
const STAFF_TEMPLATES: { id: string; name: string; role: 'driver' | 'conductor'; operatorId: string; phone?: string }[] = [
  { id: 'staff_drv_sav', name: 'Moses Okello', role: 'driver', operatorId: 'op_savannah', phone: '+256 700 100200' },
  { id: 'staff_con_sav', name: 'Grace Nakato', role: 'conductor', operatorId: 'op_savannah', phone: '+256 700 100201' },
  { id: 'staff_drv_pearl', name: 'Isaac Mugisha', role: 'driver', operatorId: 'op_pearl', phone: '+256 700 100300' },
  { id: 'staff_con_pearl', name: 'Sarah Auma', role: 'conductor', operatorId: 'op_pearl', phone: '+256 700 100301' },
];

const ATTENDANTS: { id: string; name: string; hubId: string; phone?: string }[] = [
  { id: 'staff_att_kla', name: 'Peter Ssemanda', hubId: 'hub_kla_nakawa', phone: '+256 700 100400' },
  { id: 'staff_att_mbr', name: 'Diana Kembabazi', hubId: 'hub_mbr_central', phone: '+256 700 100401' },
];

export function buildSeedStaff(trips: Trip[], todayISO: string): StaffMember[] {
  const todayTrips = trips.filter((t) => t.date === todayISO);
  const drivers = STAFF_TEMPLATES.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    phone: s.phone,
    operatorId: s.operatorId,
    assignedTripIds: todayTrips.filter((t) => t.operatorId === s.operatorId).map((t) => t.id),
  }));
  const attendants: StaffMember[] = ATTENDANTS.map((a) => ({
    id: a.id, name: a.name, role: 'attendant' as const, phone: a.phone, assignedTripIds: [], assignedHubId: a.hubId,
  }));
  return [...drivers, ...attendants];
}

export function buildSeedState(todayISO: string = kampalaToday()): AppState {
  const trips = buildSeedTrips(todayISO);
  return {
    version: STORAGE_VERSION,
    role: 'passenger',
    profile: {
      name: 'Demo Traveller',
      phone: '',
      notifyBoarding: true,
      notifyDelays: true,
    },
    hubs: HUBS,
    operators: OPERATORS,
    vehicles: VEHICLES,
    routes: ROUTES,
    trips,
    bookings: [],
    activity: [],
    staff: buildSeedStaff(trips, todayISO),
  };
}

// Helper used by the tracking simulation to keep arrival estimates coherent.
export function tripTotalMinutes(trip: Trip): number {
  return minutesBetween(trip.originDeparture, trip.destinationArrival);
}
