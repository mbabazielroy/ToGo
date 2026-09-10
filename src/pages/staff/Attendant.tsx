import { useMemo, useState } from 'react';
import { CheckCircle2, Search, Users, Bus } from 'lucide-react';
import { useStore } from '../../state/store';
import { useToast } from '../../components/ToastProvider';
import { operatorById, DIRECTION_LABEL } from '../../lib/lookup';
import { formatDate, formatTime, kampalaToday } from '../../lib/time';
import { effectivePickupTime } from '../../state/logic';
import { StaffIntro } from '../../components/StaffIntro';
import { StatCard } from '../../components/ui';
import { TripStatusPill, BookingStatusPill } from '../../components/StatusPill';
import type { Booking } from '../../types';

export function Attendant() {
  const { state, checkInByReference, checkIn } = useStore();
  const toast = useToast();
  const [hubId, setHubId] = useState(state.hubs[0].id);
  const [ref, setRef] = useState('');

  const hub = state.hubs.find((h) => h.id === hubId)!;

  // Trips serving this hub, today onwards, not cancelled/completed.
  const trips = useMemo(
    () =>
      state.trips
        .filter((t) => t.stops.some((s) => s.hubId === hubId))
        .filter((t) => t.date >= kampalaToday())
        .filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
        .sort((a, b) => a.originDeparture.localeCompare(b.originDeparture)),
    [state.trips, hubId],
  );

  // Bookings for this hub across those trips.
  const hubBookings = state.bookings.filter(
    (b) => b.pickupHubId === hubId && trips.some((t) => t.id === b.tripId),
  );
  const seats = (list: Booking[]) => list.reduce((s, b) => s + b.seats, 0);
  const expected = hubBookings.filter((b) => b.status === 'reserved' || b.status === 'checked_in');
  const checkedIn = hubBookings.filter((b) => b.status === 'checked_in');
  const boarded = hubBookings.filter((b) => b.status === 'boarded');
  const awaiting = hubBookings.filter((b) => b.status === 'reserved');

  function submitRef(e: React.FormEvent) {
    e.preventDefault();
    if (!ref.trim()) return;
    const r = checkInByReference(ref);
    if (r.ok) {
      toast(`${r.value.passengerName} checked in.`, 'ok');
      setRef('');
    } else {
      toast(r.error, 'error');
    }
  }

  return (
    <div className="space-y-4">
      <StaffIntro
        title="Hub attendant"
        subtitle="Welcome passengers, confirm arrivals, and keep the pickup running smoothly."
      />

      {/* Hub selector */}
      <div>
        <label className="field-label" htmlFor="hub">Hub</label>
        <select id="hub" className="input" value={hubId} onChange={(e) => setHubId(e.target.value)}>
          {state.hubs.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} — {h.city}
            </option>
          ))}
        </select>
      </div>

      {/* Counts (passenger quantities) */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Expected" value={seats(expected)} />
        <StatCard label="Checked in" value={seats(checkedIn)} tone="accent" />
        <StatCard label="Boarded" value={seats(boarded)} />
        <StatCard label="Awaiting" value={seats(awaiting)} tone={seats(awaiting) > 0 ? 'warn' : 'default'} />
      </div>
      <p className="-mt-2 text-[11px] text-forest-400">Counts are passenger quantities, not booking counts.</p>

      {/* Check-in tool */}
      <form onSubmit={submitRef} className="card space-y-2 p-4">
        <label className="field-label" htmlFor="ref">Check in by booking reference</label>
        <div className="flex gap-2">
          <input
            id="ref"
            className="input flex-1 font-mono uppercase"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="TG-XXXX"
            autoCapitalize="characters"
          />
          <button type="submit" className="btn-primary px-4 py-3 text-sm">
            <Search size={16} /> Check in
          </button>
        </div>
      </form>

      {/* Awaiting check-in list */}
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-forest-600">
          Bookings awaiting check-in ({awaiting.length})
        </h2>
        {awaiting.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-forest-500 shadow-card">
            Everyone expected here has checked in.
          </p>
        ) : (
          <div className="space-y-2">
            {awaiting.map((b) => {
              const trip = state.trips.find((t) => t.id === b.tripId)!;
              const pickup = effectivePickupTime(trip, hubId);
              return (
                <div key={b.id} className="card flex items-center justify-between p-3.5">
                  <div>
                    <div className="font-semibold text-forest-900">{b.passengerName}</div>
                    <div className="text-xs text-forest-500">
                      <span className="font-mono">{b.reference}</span> · {b.seats} pax · pickup{' '}
                      {pickup ? formatTime(pickup) : '—'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const r = checkIn(b.id);
                      if (r.ok) toast(`${b.passengerName} checked in.`, 'ok');
                      else toast(r.error, 'error');
                    }}
                    className="btn-accent px-3 py-2 text-sm"
                  >
                    <CheckCircle2 size={15} /> Check in
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Upcoming buses */}
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-forest-600">
          Upcoming buses at {hub.name}
        </h2>
        {trips.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-forest-500 shadow-card">
            No upcoming buses scheduled for this hub.
          </p>
        ) : (
          <div className="space-y-2">
            {trips.map((t) => {
              const op = operatorById(state, t.operatorId);
              const forTrip = hubBookings.filter((b) => b.tripId === t.id);
              const pickup = effectivePickupTime(t, hubId);
              return (
                <div key={t.id} className="card p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-100 text-forest-700">
                        <Bus size={16} />
                      </span>
                      <div>
                        <div className="text-sm font-bold text-forest-900">{op?.name}</div>
                        <div className="text-[11px] text-forest-400">
                          {DIRECTION_LABEL[t.direction]} · {formatDate(t.date)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-forest-900">
                        {pickup ? formatTime(pickup) : '—'}
                      </div>
                      <TripStatusPill status={t.status} delayed={t.delayMinutes > 0} />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <MiniStat icon={<Users size={12} />} label="expected" value={seats(forTrip.filter((b) => b.status !== 'boarded' && b.status !== 'cancelled'))} />
                    <MiniStat label="checked in" value={seats(forTrip.filter((b) => b.status === 'checked_in'))} tone="accent" />
                    <MiniStat label="boarded" value={seats(forTrip.filter((b) => b.status === 'boarded'))} />
                  </div>
                  {forTrip.filter((b) => b.status === 'checked_in').length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {forTrip
                        .filter((b) => b.status === 'checked_in')
                        .map((b) => (
                          <span
                            key={b.id}
                            className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-2 py-0.5 text-[11px] font-medium text-forest-800"
                          >
                            {b.passengerName} <BookingStatusPill status={b.status} />
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
  tone?: 'accent';
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        tone === 'accent' ? 'bg-lime-200 text-forest-900' : 'bg-forest-50 text-forest-700'
      }`}
    >
      {icon}
      {value} {label}
    </span>
  );
}
