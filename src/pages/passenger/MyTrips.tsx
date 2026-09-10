import { Link, useNavigate } from 'react-router-dom';
import { Ticket, ChevronRight, Search } from 'lucide-react';
import { useStore } from '../../state/store';
import { operatorById, hubById, DIRECTION_LABEL } from '../../lib/lookup';
import { formatDate, formatTime, formatUGX } from '../../lib/time';
import { effectivePickupTime } from '../../state/logic';
import { BookingStatusPill } from '../../components/StatusPill';
import { EmptyState, SectionHeading } from '../../components/ui';
import type { Booking } from '../../types';

export function MyTrips() {
  const { state } = useStore();
  const navigate = useNavigate();

  const upcoming: Booking[] = [];
  const completed: Booking[] = [];
  const cancelled: Booking[] = [];
  for (const b of state.bookings) {
    if (b.status === 'cancelled') cancelled.push(b);
    else if (b.status === 'completed') completed.push(b);
    else upcoming.push(b);
  }
  const byDeparture = (a: Booking, b: Booking) => {
    const ta = state.trips.find((t) => t.id === a.tripId)?.originDeparture ?? '';
    const tb = state.trips.find((t) => t.id === b.tripId)?.originDeparture ?? '';
    return ta.localeCompare(tb);
  };
  upcoming.sort(byDeparture);
  completed.sort(byDeparture).reverse();
  cancelled.sort(byDeparture).reverse();

  const total = state.bookings.length;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-forest-900">My Trips</h1>

      {total === 0 ? (
        <EmptyState icon={<Ticket size={40} />} title="No trips yet">
          Reserve a seat and it will appear here with your boarding pass.
          <span className="mt-3 block">
            <Link to="/" className="btn-primary">
              <Search size={16} /> Find buses
            </Link>
          </span>
        </EmptyState>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <SectionHeading title={`Upcoming (${upcoming.length})`} />
              <div className="space-y-2.5">
                {upcoming.map((b) => (
                  <TripRow key={b.id} booking={b} onClick={() => navigate(`/trips/${b.id}`)} />
                ))}
              </div>
            </section>
          )}
          {completed.length > 0 && (
            <section>
              <SectionHeading title={`Completed (${completed.length})`} />
              <div className="space-y-2.5">
                {completed.map((b) => (
                  <TripRow key={b.id} booking={b} onClick={() => navigate(`/trips/${b.id}`)} muted />
                ))}
              </div>
            </section>
          )}
          {cancelled.length > 0 && (
            <section>
              <SectionHeading title={`Cancelled (${cancelled.length})`} />
              <div className="space-y-2.5">
                {cancelled.map((b) => (
                  <TripRow key={b.id} booking={b} onClick={() => navigate(`/trips/${b.id}`)} muted />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TripRow({
  booking,
  onClick,
  muted,
}: {
  booking: Booking;
  onClick: () => void;
  muted?: boolean;
}) {
  const { state } = useStore();
  const trip = state.trips.find((t) => t.id === booking.tripId);
  if (!trip) return null;
  const op = operatorById(state, trip.operatorId);
  const hub = hubById(state, booking.pickupHubId);
  const pickup = effectivePickupTime(trip, booking.pickupHubId);

  return (
    <button
      onClick={onClick}
      className={`card flex w-full items-center gap-3 p-3.5 text-left transition active:scale-[0.99] hover:shadow-raised ${
        muted ? 'opacity-80' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-forest-900">
            {DIRECTION_LABEL[trip.direction]}
          </span>
        </div>
        <div className="mt-0.5 truncate text-xs text-forest-500">
          {op?.name} · {formatDate(trip.date)} · {pickup ? formatTime(pickup) : '—'}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <BookingStatusPill status={booking.status} />
          <span className="text-[11px] text-forest-400">
            {hub?.name} · {booking.seats} seat{booking.seats === 1 ? '' : 's'} ·{' '}
            {formatUGX(trip.farePerSeat * booking.seats)}
          </span>
        </div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-forest-300" />
    </button>
  );
}
