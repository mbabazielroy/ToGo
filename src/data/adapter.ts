// Clean data-access layer. Two implementations (demo + Supabase) satisfy this
// same interface so business rules stay consistent across modes.

export type DirectionCode = 'KLA_MBR' | 'MBR_KLA';
export type TripStatusCode = 'scheduled' | 'boarding' | 'en_route' | 'completed' | 'cancelled';
export type BookingStatusCode =
  | 'reserved' | 'checked_in' | 'boarded' | 'completed' | 'cancelled'
  | 'missed_pickup' | 'not_boarded'
  | 'no_show'; // deprecated; retained for enum stability

export interface HubView {
  id: string;
  name: string;
  city: string;
  area: string;
  arrivalInstructions?: string;
  openingHours?: string;
  facilities?: Record<string, boolean>;
  isDemo: boolean;
  /** Map position when known (hubs without coordinates simply aren't drawn). */
  lat?: number | null;
  lng?: number | null;
}

export interface TripStopView {
  id: string;
  tripId: string;
  hubId: string;
  hubName: string;
  hubCity: string;
  stopOrder: number;
  pickupTime: string; // ISO
  reached: boolean;
}

export interface TripView {
  id: string;
  operatorId: string;
  operatorName: string;
  vehicleLabel?: string;
  driverName?: string;
  conductorName?: string;
  direction: DirectionCode;
  serviceDate: string; // YYYY-MM-DD
  originDeparture: string; // ISO
  destinationArrival: string; // ISO
  fareUgx: number;
  capacity: number;
  status: TripStatusCode;
  delayMinutes: number;
  progress: number;
  lastUpdate: string;
  seatsReserved: number;
  seatsAvailable: number;
  stops: TripStopView[];
}

export interface BookingView {
  id: string;
  tripId: string;
  reference: string;
  boardingCredential: string; // opaque token for the QR
  seats: number;
  status: BookingStatusCode;
  paymentStatus: string;
  fareUgxSnapshot: number;
  pickupHubId: string;
  dropoffHubId: string;
  pickupTimeSnapshot: string;
  dropoffTimeSnapshot: string;
  passengerName: string;
  unresolved: boolean;
  createdAt: string;
}

export interface ManifestRow {
  bookingId: string;
  reference: string;
  passengerName: string;
  seats: number;
  status: BookingStatusCode;
  pickupHubId: string;
  pickupStopOrder: number;
  unresolved: boolean;
}

export interface HubExpectedRow {
  bookingId: string;
  reference: string;
  passengerName: string;
  seats: number;
  status: BookingStatusCode;
  tripId: string;
  pickupTime: string;
}

export interface NotificationView {
  id: string;
  kind: string;
  title: string;
  body: string;
  tripId?: string | null;
  bookingId?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface LocationView {
  lat: number;
  lng: number;
  accuracyM?: number | null;
  observedAt: string;
  receivedAt: string;
}

export interface ReserveInput {
  tripId: string;
  pickupStopId: string;
  dropoffStopId: string;
  seats: number;
  passengerName: string;
  passengerPhone?: string;
  idempotencyKey: string;
}

export interface TripSearch {
  direction: DirectionCode;
  date: string;
  hubId?: string | null;
}

/** A staff member for preview persona switching. In connected mode the persona is
 *  the authenticated user, so `listStaff` is a preview-only directory. */
export interface StaffView {
  id: string;
  name: string;
  role: 'driver' | 'conductor' | 'attendant';
  phone?: string;
  operatorId?: string;
  operatorName?: string;
  assignedTripCount: number;
  assignedHubId?: string;
  assignedHubName?: string;
}

/** An operator (bus company) for the admin console. */
export interface OperatorView {
  id: string;
  name: string;
  rating: number;
}

/** A vehicle in an operator's fleet. */
export interface VehicleView {
  id: string;
  operatorId: string;
  label: string;
  plate: string;
  seats: number;
}

/** Something operations needs to look at: a missed pickup, a cancelled trip, a delay. */
export interface IncidentView {
  id: string;
  kind: 'missed_pickup' | 'trip_cancelled' | 'delay' | string;
  title: string;
  detail: string;
  tripId?: string | null;
  hubId?: string | null;
  at: string;
  open: boolean;
}

export interface CreateDepartureInput {
  operatorId: string;
  vehicleId: string;
  direction: DirectionCode;
  date: string; // YYYY-MM-DD (Kampala)
  departHHMM: string; // "07:00"
  durationMin: number;
  fareUgx: number;
  driverId?: string | null;
  conductorId?: string | null;
}

/** A subscription handle the UI can clean up. */
export interface Subscription {
  unsubscribe: () => void;
}

export interface DataAdapter {
  readonly mode: 'demo' | 'connected';

  // Browsing
  listHubs(): Promise<HubView[]>;
  searchTrips(q: TripSearch): Promise<TripView[]>;
  getTrip(tripId: string): Promise<TripView | null>;

  // Passenger
  reserve(input: ReserveInput): Promise<BookingView>;
  myBookings(): Promise<BookingView[]>;
  getBooking(bookingId: string): Promise<BookingView | null>;
  cancelBooking(bookingId: string): Promise<BookingView>;
  checkIn(bookingId: string): Promise<BookingView>;

  // Staff — persona directory + assignments (preview persona switching; connected
  // resolves the persona from the authenticated user's verified assignments).
  listStaff(): Promise<StaffView[]>;
  staffTrips(staffId: string): Promise<TripView[]>;
  attendantHubId(staffId: string): Promise<string | null>;

  // Staff — operations
  checkInByReference(reference: string): Promise<BookingView>;
  getTripManifest(tripId: string): Promise<ManifestRow[]>;
  getHubExpected(hubId: string): Promise<HubExpectedRow[]>;
  /** Missed-pickup / unresolved incidents recorded at a hub (attendant view). */
  hubIncidents(hubId: string): Promise<HubExpectedRow[]>;
  /** Read-only: resolve which booking a boarding credential/code would board, WITHOUT
   *  boarding it, so the UI can confirm first. Throws typed AdapterErrors
   *  (INVALID_CODE / WRONG_TRIP / CANCELLED / ALREADY_BOARDED). */
  resolveBoarding(tripId: string, credential: string): Promise<BookingView>;
  boardByCredential(tripId: string, credential: string): Promise<BookingView>;
  updateTripStatus(tripId: string, status: TripStatusCode): Promise<TripView>;
  reportDelay(tripId: string, minutes: number): Promise<TripView>;
  reachHub(tripId: string, hubId: string): Promise<TripView>;
  cancelTrip(tripId: string, reason: string): Promise<TripView>;
  recordUnresolvedPickup(tripId: string, hubId: string, reason: string): Promise<number>;
  operatorUpdateTrip(
    tripId: string,
    patch: { fareUgx?: number; capacity?: number; status?: TripStatusCode; originDeparture?: string },
  ): Promise<TripView>;

  // Location
  reportLocation(tripId: string, lat: number, lng: number, accuracy: number | null, observedAt: string): Promise<void>;
  latestLocation(tripId: string): Promise<LocationView | null>;

  // Admin console — authority is enforced by the backend (platform admin / operator
  // member). In preview these run against the on-device simulated network.
  /** Every departure on a service date, both directions, including cancelled ones. */
  listTripsOn(date: string): Promise<TripView[]>;
  listOperators(): Promise<OperatorView[]>;
  listVehicles(): Promise<VehicleView[]>;
  createDeparture(input: CreateDepartureInput): Promise<TripView>;
  /** Assign (or with staffId null, clear) a trip's driver or conductor. */
  assignCrew(tripId: string, role: 'driver' | 'conductor', staffId: string | null): Promise<TripView>;
  listIncidents(): Promise<IncidentView[]>;
  /** Operations-wide activity feed (admin), as opposed to a passenger's own notifications. */
  listActivity(): Promise<NotificationView[]>;

  // Notifications
  listNotifications(): Promise<NotificationView[]>;
  markNotificationRead(id: string): Promise<void>;

  // Realtime (no-op in demo)
  subscribeMyBookings(onChange: () => void): Subscription;
  subscribeTrip(tripId: string, onChange: () => void): Subscription;
}

/** Error type carrying a stable machine code parsed from the backend message. */
export class AdapterError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AdapterError';
  }
}
