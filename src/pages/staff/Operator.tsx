import { useMemo, useState } from 'react';
import {
  Bus,
  Users,
  Armchair,
  Clock,
  AlertTriangle,
  Pencil,
  XCircle,
  Activity as ActivityIcon,
} from 'lucide-react';
import { useStore } from '../../state/store';
import { useToast } from '../../components/ToastProvider';
import { operatorById, DIRECTION_LABEL } from '../../lib/lookup';
import { formatTime, formatUGX, timeAgo, kampalaToday } from '../../lib/time';
import { availableSeats, seatsReserved } from '../../state/logic';
import { StaffIntro } from '../../components/StaffIntro';
import { StatCard } from '../../components/ui';
import { TripStatusPill } from '../../components/StatusPill';
import type { Trip } from '../../types';

export function Operator() {
  const { state } = useStore();
  const today = kampalaToday();

  const todaysTrips = useMemo(
    () =>
      state.trips
        .filter((t) => t.date === today)
        .sort((a, b) => a.originDeparture.localeCompare(b.originDeparture)),
    [state.trips, today],
  );

  const activeBuses = todaysTrips.filter((t) => t.status === 'en_route' || t.status === 'boarding');
  const reservedSeats = todaysTrips.reduce((s, t) => s + seatsReserved(state, t.id), 0);
  const waiting = state.bookings.filter((b) => {
    const t = state.trips.find((x) => x.id === b.tripId);
    return b.status === 'checked_in' && t?.date === today;
  });
  const waitingSeats = waiting.reduce((s, b) => s + b.seats, 0);
  const delayed = todaysTrips.filter(
    (t) => t.delayMinutes > 0 && t.status !== 'completed' && t.status !== 'cancelled',
  );
  const unresolved = state.bookings.filter((b) => b.unresolved);
  const unresolvedSeats = unresolved.reduce((s, b) => s + b.seats, 0);

  return (
    <div className="space-y-4">
      <StaffIntro
        title="Operator dashboard"
        subtitle="Monitor today’s departures and manage the demo schedule."
      />

      {/* KPI grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Departures today" value={todaysTrips.length} />
        <StatCard label="Active buses" value={activeBuses.length} tone="accent" />
        <StatCard label="Reserved seats" value={reservedSeats} />
        <StatCard label="Passengers waiting" value={waitingSeats} />
        <StatCard label="Delayed trips" value={delayed.length} tone={delayed.length ? 'warn' : 'default'} />
        <StatCard
          label="Unresolved pickups"
          value={unresolvedSeats}
          tone={unresolvedSeats ? 'warn' : 'default'}
        />
      </div>
      <p className="-mt-2 text-[11px] text-forest-400">
        Reserved seats reflect demo reservations only — not collected revenue.
      </p>

      {/* Today's departures (editable) */}
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-forest-600">
          Today’s departures
        </h2>
        {todaysTrips.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-forest-500 shadow-card">
            No departures scheduled for today.
          </p>
        ) : (
          <div className="space-y-2">
            {todaysTrips.map((t) => (
              <DepartureRow key={t.id} trip={t} />
            ))}
          </div>
        )}
      </section>

      {/* Activity log */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-forest-600">
          <ActivityIcon size={15} /> Activity log
        </h2>
        {state.activity.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-forest-500 shadow-card">
            No activity yet. Reservations, check-ins, boarding, delays and cancellations appear here.
          </p>
        ) : (
          <ul className="card divide-y divide-forest-50">
            {state.activity.slice(0, 40).map((e) => (
              <li key={e.id} className="flex items-start gap-2 px-4 py-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor(e.kind)}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-forest-800">{e.message}</div>
                  <div className="text-[11px] text-forest-400">{timeAgo(e.at)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function dotColor(kind: string): string {
  if (kind === 'cancellation' || kind === 'trip_cancelled') return 'bg-red-400';
  if (kind === 'delay' || kind === 'unresolved_pickup') return 'bg-amber-400';
  if (kind === 'boarding' || kind === 'check_in') return 'bg-lime-400';
  if (kind === 'trip_completed') return 'bg-forest-500';
  return 'bg-forest-300';
}

function DepartureRow({ trip }: { trip: Trip }) {
  const { state, editTrip, cancelTrip } = useStore();
  const toast = useToast();
  const op = operatorById(state, trip.operatorId);
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  const active = seatsReserved(state, trip.id);
  const avail = availableSeats(state, trip);

  const departTime = formatTime(trip.originDeparture);
  const [form, setForm] = useState({
    time: departTime,
    fare: trip.farePerSeat,
    capacity: trip.capacity,
    status: trip.status,
  });

  function save() {
    // Convert HH:MM to a new originDeparture on the same date.
    const [hh, mm] = form.time.split(':').map(Number);
    const iso = `${trip.date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+03:00`;
    const r = editTrip(trip.id, {
      originDeparture: new Date(iso).toISOString(),
      farePerSeat: Number(form.fare),
      capacity: Number(form.capacity),
      status: form.status,
    });
    if (r.ok) {
      toast('Departure updated.', 'ok');
      setEditing(false);
    } else {
      toast(r.error, 'error');
    }
  }

  return (
    <div className="card p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-100 text-forest-700">
            <Bus size={18} />
          </span>
          <div>
            <div className="text-sm font-bold text-forest-900">{op?.name}</div>
            <div className="text-[11px] text-forest-400">{DIRECTION_LABEL[trip.direction]}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-forest-900">{departTime}</div>
          <TripStatusPill status={trip.status} delayed={trip.delayMinutes > 0} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <Chip icon={<Armchair size={11} />}>{avail} free / {trip.capacity}</Chip>
        <Chip icon={<Users size={11} />}>{active} reserved</Chip>
        <Chip>{formatUGX(trip.farePerSeat)}</Chip>
        {trip.delayMinutes > 0 && (
          <Chip icon={<Clock size={11} />} tone="warn">
            +{trip.delayMinutes} min
          </Chip>
        )}
        {trip.status === 'en_route' && (
          <Chip>{Math.round(trip.progress * 100)}% · ETA {formatTime(effectiveArrivalLocal(trip))}</Chip>
        )}
      </div>

      {trip.status !== 'completed' && trip.status !== 'cancelled' && (
        <div className="mt-2.5 flex gap-2">
          <button onClick={() => setEditing((e) => !e)} className="btn-ghost flex-1 py-2 text-xs">
            <Pencil size={14} /> Edit
          </button>
          <button
            onClick={() => setCancelling((c) => !c)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white py-2 text-xs font-semibold text-red-600"
          >
            <XCircle size={14} /> Cancel trip
          </button>
        </div>
      )}

      {editing && (
        <div className="mt-3 space-y-2.5 rounded-xl bg-sand-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="field-label">Departure</span>
              <input
                type="time"
                className="input"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="field-label">Fare (UGX)</span>
              <input
                type="number"
                min={0}
                step={500}
                className="input"
                value={form.fare}
                onChange={(e) => setForm({ ...form, fare: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="field-label">Capacity (≥ {active})</span>
              <input
                type="number"
                min={active}
                className="input"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="field-label">Status</span>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Trip['status'] })}
              >
                <option value="scheduled">Scheduled</option>
                <option value="boarding">Boarding</option>
                <option value="en_route">En route</option>
                <option value="completed">Completed</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-ghost flex-1 py-2 text-xs">
              Discard
            </button>
            <button onClick={save} className="btn-primary flex-1 py-2 text-xs">
              Save changes
            </button>
          </div>
        </div>
      )}

      {cancelling && (
        <div className="mt-3 space-y-2 rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
            <AlertTriangle size={15} /> Cancel this trip
          </div>
          <p className="text-xs text-red-700/80">
            {active} reserved seat{active === 1 ? '' : 's'} will be cancelled and affected passengers
            updated.
          </p>
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (e.g. vehicle maintenance)"
          />
          <div className="flex gap-2">
            <button onClick={() => setCancelling(false)} className="btn-ghost flex-1 py-2 text-xs">
              Keep trip
            </button>
            <button
              onClick={() => {
                const r = cancelTrip(trip.id, reason);
                if (r.ok) {
                  toast('Trip cancelled.', 'ok');
                  setCancelling(false);
                } else toast(r.error, 'error');
              }}
              disabled={!reason.trim()}
              className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Confirm cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function effectiveArrivalLocal(trip: Trip): string {
  return new Date(new Date(trip.destinationArrival).getTime() + trip.delayMinutes * 60000).toISOString();
}

function Chip({
  children,
  icon,
  tone,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'warn';
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
        tone === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-forest-50 text-forest-700'
      }`}
    >
      {icon}
      {children}
    </span>
  );
}
