import { useMemo, useState } from 'react';
import {
  Bus,
  Users,
  Armchair,
  Clock,
  AlertTriangle,
  Pencil,
  XCircle,
  Plus,
  UserCog,
  ListChecks,
  Activity as ActivityIcon,
} from 'lucide-react';
import { useStore } from '../../state/store';
import { useToast } from '../../components/ToastProvider';
import { operatorById, vehicleById, hubById, DIRECTION_LABEL } from '../../lib/lookup';
import { formatTime, formatUGX, timeAgo, kampalaToday, addDays, formatDate } from '../../lib/time';
import { availableSeats, seatsReserved, staffForTrip } from '../../state/logic';
import { StaffIntro } from '../../components/StaffIntro';
import { StatCard } from '../../components/ui';
import { TripStatusPill, BookingStatusPill } from '../../components/StatusPill';
import type { Trip, StaffMember } from '../../types';

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
        title="Dispatcher console"
        subtitle="Create and crew today’s departures, then monitor them end to end."
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
        Reserved seats are booked fares, not money collected — fares are paid to the operator at
        boarding.
      </p>

      <NewDeparture />

      {/* Today's departures (editable) */}
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-forest-600">
          Today’s departures
        </h2>
        {todaysTrips.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-forest-500 shadow-card">
            No departures scheduled for today. Use “New departure” above to create one.
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
  if (kind === 'trip_created' || kind === 'assignment') return 'bg-forest-400';
  return 'bg-forest-300';
}

// ---------------------------------------------------------------------------
// Create a new departure
// ---------------------------------------------------------------------------
function NewDeparture() {
  const { state, createTrip } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const [operatorId, setOperatorId] = useState(state.operators[0]?.id ?? '');
  const [routeId, setRouteId] = useState(state.routes[0]?.id ?? '');
  const operatorVehicles = state.vehicles.filter((v) => v.operatorId === operatorId);
  const [vehicleId, setVehicleId] = useState(operatorVehicles[0]?.id ?? '');
  const [date, setDate] = useState(kampalaToday());
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(240);
  const [fare, setFare] = useState(25000);
  const [driverId, setDriverId] = useState('');
  const [conductorId, setConductorId] = useState('');

  // Keep the vehicle valid for the chosen operator.
  function chooseOperator(id: string) {
    setOperatorId(id);
    const vs = state.vehicles.filter((v) => v.operatorId === id);
    setVehicleId(vs[0]?.id ?? '');
    setDriverId('');
    setConductorId('');
  }

  const drivers = (state.staff ?? []).filter((s) => s.role === 'driver' && s.operatorId === operatorId);
  const conductors = (state.staff ?? []).filter(
    (s) => s.role === 'conductor' && s.operatorId === operatorId,
  );
  const dateChoices = [0, 1, 2, 3].map((d) => addDays(kampalaToday(), d));

  function submit() {
    const r = createTrip({
      operatorId,
      routeId,
      vehicleId,
      date,
      departHHMM: time,
      durationMin: Number(duration),
      farePerSeat: Number(fare),
      driverId: driverId || null,
      conductorId: conductorId || null,
    });
    if (r.ok) {
      toast('Departure created.', 'ok');
      setOpen(false);
      setDriverId('');
      setConductorId('');
    } else {
      toast(r.error, 'error');
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-forest-300 bg-white py-3 text-sm font-semibold text-forest-700 hover:bg-forest-50"
      >
        <Plus size={16} /> New departure
      </button>
    );
  }

  const vehicle = vehicleById(state, vehicleId);

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-forest-600">New departure</h2>
        <button onClick={() => setOpen(false)} className="text-xs font-semibold text-forest-400">
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Operator</span>
          <select className="input" value={operatorId} onChange={(e) => chooseOperator(e.target.value)}>
            {state.operators.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Route</span>
          <select className="input" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            {state.routes.map((r) => (
              <option key={r.id} value={r.id}>{DIRECTION_LABEL[r.direction]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Vehicle (sets capacity)</span>
          <select className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {operatorVehicles.length === 0 && <option value="">No vehicles</option>}
            {operatorVehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.label} · {v.seats} seats</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Date</span>
          <select className="input" value={date} onChange={(e) => setDate(e.target.value)}>
            {dateChoices.map((d) => (
              <option key={d} value={d}>{formatDate(d)}{d === kampalaToday() ? ' (today)' : ''}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Departure time</span>
          <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">Journey (min)</span>
          <input
            type="number"
            min={1}
            step={5}
            className="input"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="field-label">Fare / seat (UGX)</span>
          <input
            type="number"
            min={0}
            step={500}
            className="input"
            value={fare}
            onChange={(e) => setFare(Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="field-label">Driver (optional)</span>
          <select className="input" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">Assign later</option>
            {drivers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Conductor (optional)</span>
          <select className="input" value={conductorId} onChange={(e) => setConductorId(e.target.value)}>
            <option value="">Assign later</option>
            {conductors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-[11px] text-forest-400">
        Arrival is departure + journey time. Pickup stops come from the route order. A driver or
        conductor already crewing an overlapping trip is rejected.
      </p>
      <button onClick={submit} disabled={!vehicle} className="btn-primary w-full py-2.5 text-sm">
        Create departure{vehicle ? ` · ${vehicle.seats} seats` : ''}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A single departure: status, edit, cancel, crew, manifest
// ---------------------------------------------------------------------------
function DepartureRow({ trip }: { trip: Trip }) {
  const { state, editTrip, cancelTrip } = useStore();
  const toast = useToast();
  const op = operatorById(state, trip.operatorId);
  const vehicle = vehicleById(state, trip.vehicleId);
  const [panel, setPanel] = useState<null | 'edit' | 'cancel' | 'crew' | 'manifest'>(null);
  const [reason, setReason] = useState('');

  const driver = staffForTrip(state, trip.id, 'driver');
  const conductor = staffForTrip(state, trip.id, 'conductor');

  const active = seatsReserved(state, trip.id);
  const avail = availableSeats(state, trip);
  const editable = trip.status !== 'completed' && trip.status !== 'cancelled';

  const departTime = formatTime(trip.originDeparture);
  const [form, setForm] = useState({
    time: departTime,
    fare: trip.farePerSeat,
    capacity: trip.capacity,
    status: trip.status,
  });

  function save() {
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
      setPanel(null);
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
        {vehicle && <Chip>{vehicle.label}</Chip>}
        {trip.delayMinutes > 0 && (
          <Chip icon={<Clock size={11} />} tone="warn">+{trip.delayMinutes} min</Chip>
        )}
        {trip.status === 'en_route' && (
          <Chip>{Math.round(trip.progress * 100)}% · ETA {formatTime(effectiveArrivalLocal(trip))}</Chip>
        )}
      </div>

      {/* Crew summary */}
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <CrewChip label="Driver" name={driver?.name} />
        <CrewChip label="Conductor" name={conductor?.name} />
      </div>

      {/* Row actions */}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          onClick={() => setPanel((p) => (p === 'manifest' ? null : 'manifest'))}
          className="btn-ghost flex-1 py-2 text-xs"
        >
          <ListChecks size={14} /> Manifest ({active})
        </button>
        {editable && (
          <>
            <button
              onClick={() => setPanel((p) => (p === 'crew' ? null : 'crew'))}
              className="btn-ghost flex-1 py-2 text-xs"
            >
              <UserCog size={14} /> Crew
            </button>
            <button onClick={() => setPanel((p) => (p === 'edit' ? null : 'edit'))} className="btn-ghost flex-1 py-2 text-xs">
              <Pencil size={14} /> Edit
            </button>
            <button
              onClick={() => setPanel((p) => (p === 'cancel' ? null : 'cancel'))}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white py-2 text-xs font-semibold text-red-600"
            >
              <XCircle size={14} /> Cancel
            </button>
          </>
        )}
      </div>

      {panel === 'crew' && <CrewPanel trip={trip} />}

      {panel === 'manifest' && <Manifest trip={trip} />}

      {panel === 'edit' && (
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
          <p className="text-[11px] text-forest-400">
            Editing the fare does not change fares already quoted on existing bookings.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPanel(null)} className="btn-ghost flex-1 py-2 text-xs">Discard</button>
            <button onClick={save} className="btn-primary flex-1 py-2 text-xs">Save changes</button>
          </div>
        </div>
      )}

      {panel === 'cancel' && (
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
            <button onClick={() => setPanel(null)} className="btn-ghost flex-1 py-2 text-xs">Keep trip</button>
            <button
              onClick={() => {
                const r = cancelTrip(trip.id, reason);
                if (r.ok) {
                  toast('Trip cancelled.', 'ok');
                  setPanel(null);
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

function CrewChip({ label, name }: { label: string; name?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
        name ? 'bg-forest-50 text-forest-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      <UserCog size={11} /> {label}: {name ?? 'unassigned'}
    </span>
  );
}

function CrewPanel({ trip }: { trip: Trip }) {
  const { state, assignStaff } = useStore();
  const toast = useToast();
  const driver = staffForTrip(state, trip.id, 'driver');
  const conductor = staffForTrip(state, trip.id, 'conductor');
  const drivers = (state.staff ?? []).filter((s) => s.role === 'driver' && s.operatorId === trip.operatorId);
  const conductors = (state.staff ?? []).filter(
    (s) => s.role === 'conductor' && s.operatorId === trip.operatorId,
  );

  function assign(role: 'driver' | 'conductor', value: string) {
    const r = assignStaff(trip.id, role, value || null);
    if (r.ok) toast(value ? 'Crew updated.' : `${role} unassigned.`, 'ok');
    else toast(r.error, 'error');
  }

  return (
    <div className="mt-3 grid grid-cols-1 gap-2.5 rounded-xl bg-sand-50 p-3 sm:grid-cols-2">
      <CrewSelect label="Driver" current={driver} options={drivers} onChange={(v) => assign('driver', v)} />
      <CrewSelect label="Conductor" current={conductor} options={conductors} onChange={(v) => assign('conductor', v)} />
      <p className="text-[11px] text-forest-400 sm:col-span-2">
        Only this operator’s crew appear here. Assigning someone already on an overlapping trip is
        rejected.
      </p>
    </div>
  );
}

function CrewSelect({
  label,
  current,
  options,
  onChange,
}: {
  label: string;
  current?: StaffMember;
  options: StaffMember[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <select className="input" value={current?.id ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Unassigned</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </label>
  );
}

function Manifest({ trip }: { trip: Trip }) {
  const { state } = useStore();
  const bookings = state.bookings
    .filter((b) => b.tripId === trip.id && b.status !== 'cancelled')
    .sort((a, b) => a.pickupHubId.localeCompare(b.pickupHubId));

  if (bookings.length === 0) {
    return (
      <div className="mt-3 rounded-xl bg-sand-50 p-3 text-xs text-forest-500">
        No active reservations on this departure yet.
      </div>
    );
  }
  return (
    <div className="mt-3 overflow-hidden rounded-xl bg-white ring-1 ring-forest-100">
      <ul className="divide-y divide-forest-50">
        {bookings.map((b) => {
          const hub = hubById(state, b.pickupHubId);
          const fare = (b.fareAtBooking ?? trip.farePerSeat) * b.seats;
          return (
            <li key={b.id} className="flex items-center justify-between px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-forest-900">
                  {b.passengerName}{' '}
                  <span className="font-mono text-[11px] text-forest-400">{b.reference}</span>
                </div>
                <div className="text-[11px] text-forest-500">
                  {hub?.name} · {b.seats} pax · {formatUGX(fare)} due at boarding
                </div>
              </div>
              <BookingStatusPill status={b.status} />
            </li>
          );
        })}
      </ul>
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
