import { useState } from 'react';
import { Bus, Pencil, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAdapter } from '../../../data/AdapterProvider';
import { useToast } from '../../../components/ToastProvider';
import { useAsync, humanError } from '../hooks';
import { Loading, ErrorRow, StaffNote } from '../parts';
import { StatCard } from '../../../components/ui';
import { TripStatusPill } from '../../../components/StatusPill';
import { formatTime, formatUGX, kampalaToday } from '../../../lib/time';
import type { TripStatusCode, TripView } from '../../../data/adapter';

export function OperatorWorkspace({ operatorIds }: { operatorIds: string[] }) {
  const adapter = useAdapter();
  const today = kampalaToday();
  // trips_public covers active (non-cancelled) departures; filter to this operator.
  const trips = useAsync(async () => {
    const both = await Promise.all([
      adapter.searchTrips({ direction: 'KLA_MBR', date: today }),
      adapter.searchTrips({ direction: 'MBR_KLA', date: today }),
    ]);
    return both.flat().filter((t) => operatorIds.includes(t.operatorId));
  }, [operatorIds.join(','), today]);

  const list = trips.data ?? [];
  const reserved = list.reduce((n, t) => n + t.seatsReserved, 0);
  const active = list.filter((t) => t.status === 'en_route' || t.status === 'boarding').length;
  const delayed = list.filter((t) => t.delayMinutes > 0).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-900">Operator dashboard</h1>
        <StaffNote>You manage only your operator's departures. Reserved seats are demo reservations, not revenue.</StaffNote>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Departures" value={list.length} />
        <StatCard label="Active buses" value={active} tone="accent" />
        <StatCard label="Reserved seats" value={reserved} />
        <StatCard label="Delayed" value={delayed} tone={delayed ? 'warn' : 'default'} />
      </div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-forest-600">Today's departures</h2>
        <button onClick={trips.reload} className="text-forest-400"><RefreshCw size={15} /></button>
      </div>
      {trips.loading && <Loading />}
      {trips.error && <ErrorRow message={trips.error} onRetry={trips.reload} />}
      <div className="space-y-2">
        {list.map((t) => <OperatorTripRow key={t.id} trip={t} onChanged={trips.reload} />)}
        {list.length === 0 && !trips.loading && (
          <p className="rounded-xl bg-white p-4 text-sm text-forest-500 shadow-card">No departures today.</p>
        )}
      </div>
    </div>
  );
}

function OperatorTripRow({ trip, onChanged }: { trip: TripView; onChanged: () => void }) {
  const adapter = useAdapter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [fare, setFare] = useState(trip.fareUgx);
  const [capacity, setCapacity] = useState(trip.capacity);
  const [status, setStatus] = useState<TripStatusCode>(trip.status);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string, close: () => void) {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(ok, 'ok'); close(); onChanged(); }
    catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="card p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-100 text-forest-700"><Bus size={18} /></span>
          <div>
            <div className="text-sm font-bold text-forest-900">{trip.operatorName}</div>
            <div className="text-[11px] text-forest-400">{trip.direction} · {formatTime(trip.originDeparture)}</div>
          </div>
        </div>
        <TripStatusPill status={trip.status} delayed={trip.delayMinutes > 0} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-full bg-forest-50 px-2 py-0.5 font-semibold text-forest-700">{trip.seatsAvailable} free / {trip.capacity}</span>
        <span className="rounded-full bg-forest-50 px-2 py-0.5 font-semibold text-forest-700">{trip.seatsReserved} reserved</span>
        <span className="rounded-full bg-forest-50 px-2 py-0.5 font-semibold text-forest-700">{formatUGX(trip.fareUgx)}</span>
      </div>
      {trip.status !== 'completed' && trip.status !== 'cancelled' && (
        <div className="mt-2.5 flex gap-2">
          <button onClick={() => setEditing((e) => !e)} className="btn-ghost flex-1 py-2 text-xs"><Pencil size={14} /> Edit</button>
          <button onClick={() => setCancelling((c) => !c)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white py-2 text-xs font-semibold text-red-600"><XCircle size={14} /> Cancel</button>
        </div>
      )}
      {editing && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-sand-50 p-3">
          <label className="block"><span className="field-label">Fare (UGX)</span>
            <input type="number" min={0} step={500} className="input" value={fare} onChange={(e) => setFare(Number(e.target.value))} /></label>
          <label className="block"><span className="field-label">Capacity (≥ {trip.seatsReserved})</span>
            <input type="number" min={trip.seatsReserved} className="input" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} /></label>
          <label className="block col-span-2"><span className="field-label">Status</span>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as TripStatusCode)}>
              <option value="scheduled">Scheduled</option><option value="boarding">Boarding</option>
              <option value="en_route">En route</option><option value="completed">Completed</option>
            </select></label>
          <button onClick={() => setEditing(false)} className="btn-ghost py-2 text-xs">Discard</button>
          <button disabled={busy} onClick={() => run(() => adapter.operatorUpdateTrip(trip.id, { fareUgx: fare, capacity, status }), 'Updated.', () => setEditing(false))} className="btn-primary py-2 text-xs">Save</button>
        </div>
      )}
      {cancelling && (
        <div className="mt-3 space-y-2 rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-red-700"><AlertTriangle size={15} /> Cancel this trip</div>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
          <div className="flex gap-2">
            <button onClick={() => setCancelling(false)} className="btn-ghost flex-1 py-2 text-xs">Keep</button>
            <button disabled={!reason.trim() || busy} onClick={() => run(() => adapter.cancelTrip(trip.id, reason), 'Trip cancelled.', () => setCancelling(false))} className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Confirm cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
