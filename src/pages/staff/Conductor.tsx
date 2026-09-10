import { useEffect, useMemo, useState } from 'react';
import {
  PlayCircle,
  TimerReset,
  Flag,
  MapPin,
  CheckCircle2,
  Search,
  AlertTriangle,
  Ticket,
} from 'lucide-react';
import { useStore } from '../../state/store';
import { useToast } from '../../components/ToastProvider';
import { operatorById, hubById, DIRECTION_LABEL } from '../../lib/lookup';
import { formatDate, formatTime, kampalaToday } from '../../lib/time';
import { effectivePickupTime } from '../../state/logic';
import { StaffIntro } from '../../components/StaffIntro';
import { TripStatusPill, BookingStatusPill } from '../../components/StatusPill';
import type { Booking } from '../../types';

export function Conductor() {
  const { state, startTrip, reportDelay, reachHub, completeTrip, boardByCode, boardBooking, recordUnresolvedPickup } =
    useStore();
  const toast = useToast();

  const selectableTrips = useMemo(
    () =>
      state.trips
        .filter((t) => t.date >= kampalaToday() && t.status !== 'cancelled')
        .sort((a, b) => a.originDeparture.localeCompare(b.originDeparture)),
    [state.trips],
  );

  const [tripId, setTripId] = useState(selectableTrips[0]?.id ?? '');
  useEffect(() => {
    if (!state.trips.some((t) => t.id === tripId) && selectableTrips[0]) {
      setTripId(selectableTrips[0].id);
    }
  }, [selectableTrips, tripId, state.trips]);

  const [code, setCode] = useState('');
  const [departHub, setDepartHub] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const trip = state.trips.find((t) => t.id === tripId);
  const seats = (list: Booking[]) => list.reduce((s, b) => s + b.seats, 0);

  if (!trip) {
    return (
      <div className="space-y-4">
        <StaffIntro title="Conductor" subtitle="Manage boarding and run your trip." />
        <p className="rounded-xl bg-white p-4 text-sm text-forest-500 shadow-card">
          No trips available. Reset the demo from the Account tab to restore seed data.
        </p>
      </div>
    );
  }

  const tripBookings = state.bookings.filter((b) => b.tripId === trip.id && b.status !== 'cancelled');
  const expected = tripBookings.filter((b) => b.status !== 'boarded' && b.status !== 'completed');
  const checkedIn = tripBookings.filter((b) => b.status === 'checked_in');

  function doBoardByCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    const r = boardByCode(trip!.id, code);
    if (r.ok) {
      toast(`Boarded ${r.value.passengerName} (${r.value.seats} pax).`, 'ok');
      setCode('');
    } else {
      toast(r.error, 'error');
    }
  }

  function tryDepart(hubId: string) {
    const unboarded = state.bookings.filter(
      (b) => b.tripId === trip!.id && b.pickupHubId === hubId && b.status === 'checked_in',
    );
    if (unboarded.length > 0) {
      setDepartHub(hubId);
      setReason('');
    } else {
      const r = reachHub(trip!.id, hubId);
      if (r.ok) toast('Marked hub as reached.', 'ok');
    }
  }

  function confirmDepart() {
    if (!departHub) return;
    const rec = recordUnresolvedPickup(trip!.id, departHub, reason);
    if (rec.ok) {
      reachHub(trip!.id, departHub);
      toast(`Recorded unresolved pickup (${rec.value} pax).`, 'error');
      setDepartHub(null);
    }
  }

  return (
    <div className="space-y-4">
      <StaffIntro title="Conductor" subtitle="Check boarding codes, board passengers, and run your trip." />

      {/* Trip selector */}
      <div>
        <label className="field-label" htmlFor="trip">Trip</label>
        <select id="trip" className="input" value={tripId} onChange={(e) => setTripId(e.target.value)}>
          {selectableTrips.map((t) => {
            const op = operatorById(state, t.operatorId);
            return (
              <option key={t.id} value={t.id}>
                {op?.name} · {DIRECTION_LABEL[t.direction]} · {formatDate(t.date)} {formatTime(t.originDeparture)}
              </option>
            );
          })}
        </select>
      </div>

      {/* Trip status + counts */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-forest-900">{operatorById(state, trip.operatorId)?.name}</div>
            <div className="text-xs text-forest-500">{DIRECTION_LABEL[trip.direction]}</div>
          </div>
          <TripStatusPill status={trip.status} delayed={trip.delayMinutes > 0} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-forest-50 py-2">
            <div className="text-xl font-extrabold text-forest-800">{seats(expected)}</div>
            <div className="text-[10px] uppercase tracking-wide text-forest-500">Expected pax</div>
          </div>
          <div className="rounded-xl bg-lime-100 py-2">
            <div className="text-xl font-extrabold text-forest-900">{seats(checkedIn)}</div>
            <div className="text-[10px] uppercase tracking-wide text-forest-600">Checked in</div>
          </div>
        </div>

        {/* Trip actions */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              const r = startTrip(trip.id);
              if (r.ok) toast('Trip started.', 'ok');
              else toast(r.error, 'error');
            }}
            disabled={trip.status !== 'scheduled' && trip.status !== 'boarding'}
            className="btn-ghost"
          >
            <PlayCircle size={16} /> Start trip
          </button>
          <button
            onClick={() => {
              const r = reportDelay(trip.id, 15);
              if (r.ok) toast('Delay +15 min recorded.', 'ok');
              else toast(r.error, 'error');
            }}
            disabled={trip.status === 'completed'}
            className="btn-ghost"
          >
            <TimerReset size={16} /> Report delay
          </button>
          <button
            onClick={() => {
              const r = completeTrip(trip.id);
              if (r.ok) toast('Trip completed.', 'ok');
              else toast(r.error, 'error');
            }}
            disabled={trip.status === 'completed'}
            className="btn-ghost col-span-2"
          >
            <Flag size={16} /> Complete journey
          </button>
        </div>
      </div>

      {/* Boarding-code lookup */}
      <form onSubmit={doBoardByCode} className="card space-y-2 p-4">
        <label className="field-label" htmlFor="code">Board by code</label>
        <div className="flex gap-2">
          <input
            id="code"
            className="input flex-1 font-mono text-lg tracking-widest"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="4-digit code"
            inputMode="numeric"
          />
          <button type="submit" className="btn-primary px-4 py-3 text-sm">
            <Search size={16} /> Validate
          </button>
        </div>
        <p className="text-[11px] text-forest-400">
          Invalid, cancelled, already-boarded, or other-trip codes are rejected.
        </p>
      </form>

      {/* Ordered stops + manifest */}
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-forest-600">
          Pickup stops & manifest
        </h2>
        <div className="space-y-3">
          {trip.stops.map((stop, i) => {
            const hub = hubById(state, stop.hubId);
            const atHub = tripBookings.filter((b) => b.pickupHubId === stop.hubId);
            const pickup = effectivePickupTime(trip, stop.hubId);
            const hubCheckedIn = atHub.filter((b) => b.status === 'checked_in');
            return (
              <div key={stop.hubId} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-forest-50 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        stop.reached ? 'bg-forest-600 text-white' : 'bg-forest-100 text-forest-700'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-forest-900">{hub?.name}</div>
                      <div className="text-[11px] text-forest-400">
                        <MapPin size={10} className="mr-0.5 inline" />
                        Pickup {pickup ? formatTime(pickup) : '—'}
                        {stop.reached && ' · reached'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-forest-500">
                    <div>{seats(atHub.filter((b) => b.status !== 'boarded'))} expected</div>
                    <div className="font-semibold text-forest-700">{seats(hubCheckedIn)} checked in</div>
                  </div>
                </div>

                {/* Manifest for this hub */}
                {atHub.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-forest-400">No passengers booked at this hub.</div>
                ) : (
                  <ul className="divide-y divide-forest-50">
                    {atHub.map((b) => (
                      <li key={b.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-forest-900">
                            {b.passengerName}{' '}
                            <span className="font-mono text-xs text-forest-400">#{b.boardingCode}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-forest-500">
                            <span className="font-mono">{b.reference}</span> · {b.seats} pax
                            <BookingStatusPill status={b.status} />
                          </div>
                        </div>
                        {b.status === 'boarded' ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-blue-600">
                            <CheckCircle2 size={14} /> Boarded
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              const r = boardBooking(b.id);
                              if (r.ok) toast(`Boarded ${b.passengerName}.`, 'ok');
                              else toast(r.error, 'error');
                            }}
                            className="btn-accent px-3 py-1.5 text-xs"
                          >
                            Confirm boarding
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Depart hub */}
                {!stop.reached && trip.status !== 'completed' && (
                  <div className="border-t border-forest-50 px-4 py-2.5">
                    <button
                      onClick={() => tryDepart(stop.hubId)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-forest-100 py-2 text-sm font-semibold text-forest-700"
                    >
                      Bus reached / leaving this hub
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {tripBookings.length === 0 && (
        <p className="flex items-center justify-center gap-1.5 rounded-xl bg-white p-4 text-sm text-forest-500 shadow-card">
          <Ticket size={15} /> No active bookings on this trip yet.
        </p>
      )}

      {/* Unresolved-pickup warning modal */}
      {departHub && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-raised">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle size={20} />
              <h3 className="text-lg font-bold">Checked-in passengers not boarded</h3>
            </div>
            <p className="mt-2 text-sm text-forest-600">
              {(() => {
                const n = seats(
                  state.bookings.filter(
                    (b) => b.tripId === trip.id && b.pickupHubId === departHub && b.status === 'checked_in',
                  ),
                );
                const hub = hubById(state, departHub);
                return `${n} checked-in passenger${n === 1 ? '' : 's'} at ${hub?.name} ${
                  n === 1 ? 'has' : 'have'
                } not boarded. Leaving now records an unresolved pickup. Please give a reason.`;
              })()}
            </p>
            <textarea
              className="input mt-3 min-h-[72px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Passenger not present at departure time"
            />
            <div className="mt-3 flex gap-2">
              <button onClick={() => setDepartHub(null)} className="btn-ghost flex-1">
                Go back
              </button>
              <button
                onClick={confirmDepart}
                disabled={!reason.trim()}
                className="flex-1 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Record & leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
