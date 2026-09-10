// ToGo domain models. All data is illustrative/demo only.

export type City = 'Kampala' | 'Mbarara';

export type Direction = 'KLA_MBR' | 'MBR_KLA';

export interface HubFacilities {
  shelter: boolean;
  seating: boolean;
  toilets: boolean;
  attendant: boolean;
  water: boolean;
  lighting: boolean;
}

export interface Hub {
  id: string;
  name: string;
  city: City;
  /** Illustrative area/neighbourhood description. */
  area: string;
  /** Short arrival instructions for passengers. */
  arrivalInstructions: string;
  openingHours: string;
  facilities: HubFacilities;
}

export interface Operator {
  id: string;
  name: string;
  /** Illustrative rating out of 5. */
  rating: number;
}

export interface Vehicle {
  id: string;
  operatorId: string;
  label: string; // e.g. "Coaster 33-seat"
  plate: string; // fictional plate
  seats: number;
}

export interface Route {
  id: string;
  direction: Direction;
  originCity: City;
  destinationCity: City;
  /** Ordered hub ids the route can pick up from, origin side first. */
  hubSequence: string[];
}

export type TripStatus = 'scheduled' | 'boarding' | 'en_route' | 'completed' | 'cancelled';

export interface TripStop {
  hubId: string;
  order: number;
  /** ISO string — estimated pickup time at this hub. */
  pickupTime: string;
  /** Whether the bus has reached/left this stop in the simulation. */
  reached: boolean;
}

export interface Trip {
  id: string;
  routeId: string;
  operatorId: string;
  vehicleId: string;
  direction: Direction;
  /** ISO date (YYYY-MM-DD) in Africa/Kampala. */
  date: string;
  /** ISO string — scheduled departure from origin terminal. */
  originDeparture: string;
  /** ISO string — estimated arrival at destination. */
  destinationArrival: string;
  farePerSeat: number; // UGX
  capacity: number;
  status: TripStatus;
  /** Delay applies independently of status (an en_route trip can be delayed). */
  delayMinutes: number;
  /** Ordered pickup stops. */
  stops: TripStop[];
  /** Simulated tracking progress 0..1 along the route. */
  progress: number;
  /** ISO string — last simulated tracking update. */
  lastUpdate: string;
  /** Reason recorded if the trip is cancelled. */
  cancelReason?: string;
}

export type BookingStatus =
  | 'reserved'
  | 'checked_in'
  | 'boarded'
  | 'completed'
  | 'cancelled'
  // Terminal outcomes recorded when a trip completes with the booking un-boarded:
  | 'missed_pickup' // checked in but not boarded — operational investigation
  | 'not_boarded'; // reserved, never checked in — neutral, no fault assigned

export interface Booking {
  id: string;
  reference: string; // e.g. TG-4F2A
  boardingCode: string; // e.g. 8391
  tripId: string;
  /** Hub the passenger will be picked up from. */
  pickupHubId: string;
  passengerName: string;
  phone?: string;
  /** Number of seats/passengers in this booking. */
  seats: number;
  status: BookingStatus;
  createdAt: string;
  checkedInAt?: string;
  boardedAt?: string;
  cancelledAt?: string;
  /** If boarding happened somewhere other than the recorded hub, or was skipped. */
  unresolved?: boolean;
}

export type ActivityKind =
  | 'reservation'
  | 'cancellation'
  | 'check_in'
  | 'boarding'
  | 'trip_start'
  | 'delay'
  | 'trip_completed'
  | 'trip_cancelled'
  | 'unresolved_pickup'
  | 'reach_hub'
  | 'schedule_edit';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  message: string;
  tripId?: string;
  bookingId?: string;
  hubId?: string;
  at: string; // ISO
}

export type DemoRole = 'passenger' | 'attendant' | 'conductor' | 'operator';

export interface DemoProfile {
  name: string;
  phone: string;
  notifyBoarding: boolean;
  notifyDelays: boolean;
}

export interface AppState {
  version: number;
  role: DemoRole;
  profile: DemoProfile;
  hubs: Hub[];
  operators: Operator[];
  vehicles: Vehicle[];
  routes: Route[];
  trips: Trip[];
  bookings: Booking[];
  activity: ActivityEvent[];
}
