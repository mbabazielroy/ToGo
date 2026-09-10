import type { BookingStatus, TripStatus } from '../types';

const TRIP_STYLES: Record<TripStatus, string> = {
  scheduled: 'bg-forest-100 text-forest-700',
  boarding: 'bg-lime-200 text-forest-900',
  en_route: 'bg-blue-100 text-blue-800',
  completed: 'bg-forest-200 text-forest-800',
  cancelled: 'bg-red-100 text-red-700',
};

const TRIP_LABELS: Record<TripStatus, string> = {
  scheduled: 'Scheduled',
  boarding: 'Boarding',
  en_route: 'En route',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const BOOKING_STYLES: Record<BookingStatus, string> = {
  reserved: 'bg-forest-100 text-forest-700',
  checked_in: 'bg-lime-200 text-forest-900',
  boarded: 'bg-blue-100 text-blue-800',
  completed: 'bg-forest-200 text-forest-800',
  cancelled: 'bg-red-100 text-red-700',
};

const BOOKING_LABELS: Record<BookingStatus, string> = {
  reserved: 'Reserved',
  checked_in: 'Checked in',
  boarded: 'Boarded',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function Base({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

export function TripStatusPill({ status, delayed }: { status: TripStatus; delayed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Base className={TRIP_STYLES[status]}>{TRIP_LABELS[status]}</Base>
      {delayed && status !== 'cancelled' && status !== 'completed' && (
        <Base className="bg-amber-100 text-amber-800">Delayed</Base>
      )}
    </span>
  );
}

export function BookingStatusPill({ status }: { status: BookingStatus }) {
  return <Base className={BOOKING_STYLES[status]}>{BOOKING_LABELS[status]}</Base>;
}
