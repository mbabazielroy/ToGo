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
