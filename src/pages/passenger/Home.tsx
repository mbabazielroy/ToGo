import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeftRight, CalendarDays, Users, MapPin, Search, Ticket } from 'lucide-react';
import { useStore } from '../../state/store';
import { useSearch } from '../../state/search';
import { hubById, operatorById, DIRECTION_LABEL } from '../../lib/lookup';
import { formatDate, formatTime, formatUGX, kampalaToday } from '../../lib/time';
import { effectivePickupTime } from '../../state/logic';
import { TripStatusPill } from '../../components/StatusPill';
import type { Booking } from '../../types';

export function Home() {
  const { state } = useStore();
  const { criteria, setCriteria, toggleDirection } = useSearch();
  const navigate = useNavigate();

  const route = state.routes.find((r) => r.direction === criteria.direction)!;
  const originHubs = route.hubSequence.map((id) => hubById(state, id)!).filter(Boolean);
  const [originCity, destinationCity] =
    criteria.direction === 'KLA_MBR' ? ['Kampala', 'Mbarara'] : ['Mbarara', 'Kampala'];

  // Earliest active booking as the "upcoming trip".
  const upcoming = [...state.bookings]
    .filter((b) => b.status === 'reserved' || b.status === 'checked_in' || b.status === 'boarded')
    .map((b) => ({ b, trip: state.trips.find((t) => t.id === b.tripId) }))
    .filter((x) => x.trip)
    .sort((a, b) => a.trip!.originDeparture.localeCompare(b.trip!.originDeparture))[0];

  function findBuses() {
    navigate('/search');
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-900">Find your hub. Meet your bus.</h1>
        <p className="mt-1 text-sm text-forest-500">
          Reserve a seat, check in at a pickup hub, and board with a code.
        </p>
      </div>

      {upcoming && <UpcomingCard booking={upcoming.b} />}

      {/* Search card */}
      <div className="card space-y-4 p-4">
        {/* Direction */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="field-label">From</div>
            <div className="text-lg font-bold text-forest-900">{originCity}</div>
          </div>
          <button
            onClick={toggleDirection}
            aria-label="Switch direction"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-forest-200 bg-forest-50 text-forest-700 transition active:scale-95 hover:bg-forest-100"
          >
            <ArrowLeftRight size={18} />
          </button>
          <div className="flex-1 text-right">
            <div className="field-label">To</div>
            <div className="text-lg font-bold text-forest-900">{destinationCity}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="date">
              <CalendarDays size={12} className="mr-1 inline" /> Date
            </label>
            <input
              id="date"
              type="date"
              className="input"
              value={criteria.date}
              min={kampalaToday()}
              onChange={(e) => setCriteria({ date: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="pax">
              <Users size={12} className="mr-1 inline" /> Passengers
            </label>
            <select
              id="pax"
              className="input"
              value={criteria.passengers}
              onChange={(e) => setCriteria({ passengers: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} passenger{n > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Hub selection */}
        <div>
          <div className="field-label">
            <MapPin size={12} className="mr-1 inline" /> Pickup hub
          </div>
          <div className="grid gap-2">
            {originHubs.map((h) => {
              const selected = criteria.hubId === h.id;
              return (
                <button
                  key={h.id}
                  onClick={() => setCriteria({ hubId: h.id })}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                    selected
                      ? 'border-forest-600 bg-forest-50 ring-1 ring-forest-500'
                      : 'border-forest-200 bg-white hover:bg-forest-50'
                  }`}
                >
                  <span>
                    <span className="block text-sm font-semibold text-forest-900">{h.name}</span>
                    <span className="block text-xs text-forest-500">{h.area}</span>
                  </span>
                  <span
                    className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      selected ? 'border-forest-600 bg-forest-600' : 'border-forest-300'
                    }`}
                  >
                    {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-forest-400">
            Any hub is optional — leave it and we’ll show every departure for {originCity}.
          </p>
        </div>

        <button onClick={findBuses} className="btn-primary w-full">
          <Search size={18} /> Find buses
        </button>
      </div>

      <p className="text-center text-[11px] text-forest-400">
        Times shown in Africa/Kampala. Fares in UGX. All data is illustrative.
      </p>
    </div>
  );
}

function UpcomingCard({ booking }: { booking: Booking }) {
  const { state } = useStore();
  const navigate = useNavigate();
  const trip = state.trips.find((t) => t.id === booking.tripId)!;
  const operator = operatorById(state, trip.operatorId);
  const pickup = effectivePickupTime(trip, booking.pickupHubId);
  const hub = hubById(state, booking.pickupHubId);

  return (
    <button
      onClick={() => navigate(`/trips/${booking.id}`)}
      className="block w-full rounded-2xl bg-forest-700 p-4 text-left text-white shadow-raised transition active:scale-[0.99]"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-lime-200">
          <Ticket size={14} /> Your upcoming trip
        </span>
        <TripStatusPill status={trip.status} delayed={trip.delayMinutes > 0} />
      </div>
      <div className="mt-2 text-lg font-bold">{DIRECTION_LABEL[trip.direction]}</div>
      <div className="mt-1 text-sm text-forest-100/90">
        {operator?.name} · {formatDate(trip.date)}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm">
        <span>
          <span className="block text-[11px] uppercase text-forest-100/70">Pickup</span>
          <span className="font-semibold">{pickup ? formatTime(pickup) : '—'}</span>
        </span>
        <span className="text-right">
          <span className="block text-[11px] uppercase text-forest-100/70">Hub</span>
          <span className="font-semibold">{hub?.name}</span>
        </span>
        <ArrowRight size={18} className="text-lime-300" />
      </div>
      <div className="mt-2 text-right text-[11px] text-forest-100/70">
        Ref {booking.reference} · {formatUGX(trip.farePerSeat * booking.seats)}
      </div>
    </button>
  );
}
