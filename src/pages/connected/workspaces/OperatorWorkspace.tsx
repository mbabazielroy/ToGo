import { useMemo, useState } from 'react';
import { Bus, Plus, RefreshCw, XCircle, TimerReset, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAdapter } from '../../../data/AdapterProvider';
import { useToast } from '../../../components/ToastProvider';
import { useAsync, humanError } from '../hooks';
import { Loading, ErrorRow, StaffNote } from '../parts';
import { TripStatusPill } from '../../../components/StatusPill';
import { management, type RouteRow } from '../../../data/management';
import { formatTime, formatDate, formatUGX } from '../../../lib/time';
import type { TripStatusCode } from '../../../data/adapter';

type Tab = 'departures' | 'fleet' | 'routes' | 'team' | 'incidents';

export function OperatorWorkspace({ operatorIds }: { operatorIds: string[] }) {
  const [operatorId, setOperatorId] = useState(operatorIds[0] ?? '');
  const [tab, setTab] = useState<Tab>('departures');
  const operators = useAsync(() => management.listOperators(), []);
  const mine = (operators.data ?? []).filter((o) => operatorIds.includes(o.id));

  if (!operatorId) return <p className="text-forest-500">You are not assigned to an operator.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-900">Operator console</h1>
        <StaffNote>You manage only your own operator's fleet, routes, departures and team. Reserved seats are demo reservations, not revenue.</StaffNote>
      </div>
      {mine.length > 1 && (
        <label className="block"><span className="field-label">Operator</span>
          <select className="input" value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
            {mine.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select></label>
      )}
      <div className="flex gap-1 overflow-x-auto">
        {(['departures', 'fleet', 'routes', 'team', 'incidents'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold capitalize ${tab === t ? 'bg-forest-700 text-white' : 'bg-white text-forest-600 shadow-card'}`}>{t}</button>
        ))}
      </div>
      {tab === 'departures' && <Departures key={operatorId} operatorId={operatorId} />}
      {tab === 'fleet' && <Fleet key={operatorId} operatorId={operatorId} />}
      {tab === 'routes' && <Routes key={operatorId} operatorId={operatorId} />}
      {tab === 'team' && <Team key={operatorId} operatorId={operatorId} />}
      {tab === 'incidents' && <Incidents key={operatorId} operatorId={operatorId} />}
    </div>
  );
}

// ------------------------------- Departures -------------------------------
function Departures({ operatorId }: { operatorId: string }) {
  const adapter = useAdapter();
  const toast = useToast();
  const trips = useAsync(() => management.listOperatorTrips(operatorId), [operatorId]);
  const routes = useAsync(() => management.listRoutes(operatorId), [operatorId]);
  const vehicles = useAsync(() => management.listVehicles(operatorId), [operatorId]);
  const [creating, setCreating] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast(ok, 'ok'); trips.reload(); } catch (e) { toast(humanError(e), 'error'); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-forest-600">Departures</h2>
        <div className="flex gap-2">
          <button onClick={trips.reload} className="text-forest-400"><RefreshCw size={15} /></button>
          <button onClick={() => setCreating((c) => !c)} className="btn-primary px-3 py-1.5 text-xs"><Plus size={14} /> New</button>
        </div>
      </div>
      {creating && <NewDeparture operatorId={operatorId} routes={routes.data ?? []} vehicles={vehicles.data ?? []}
        onCreated={() => { setCreating(false); trips.reload(); }} />}
      {trips.loading && <Loading />}
      {trips.error && <ErrorRow message={trips.error} onRetry={trips.reload} />}
      <div className="space-y-2">
        {(trips.data ?? []).map((t) => (
          <div key={t.id} className="card p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-100 text-forest-700"><Bus size={16} /></span>
                <div><div className="text-sm font-bold text-forest-900">{t.direction} · {formatDate(t.service_date)}</div>
                  <div className="text-[11px] text-forest-400">Depart {formatTime(t.origin_departure)} · {formatUGX(t.fare_ugx)} · cap {t.capacity}</div></div>
              </div>
              <TripStatusPill status={t.status} delayed={t.delay_minutes > 0} />
            </div>
            {t.status !== 'completed' && t.status !== 'cancelled' && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => run(() => adapter.reportDelay(t.id, 15), 'Delay +15m.')} className="btn-ghost px-3 py-1.5 text-xs"><TimerReset size={14} /> Delay 15m</button>
                <EditTrip tripId={t.id} fare={t.fare_ugx} capacity={t.capacity} status={t.status} onDone={trips.reload} />
                <CancelTrip tripId={t.id} onDone={trips.reload} />
              </div>
            )}
          </div>
        ))}
        {(trips.data?.length ?? 0) === 0 && !trips.loading && <p className="rounded-xl bg-white p-4 text-sm text-forest-500 shadow-card">No departures yet.</p>}
      </div>
    </div>
  );
}

function EditTrip({ tripId, fare, capacity, status, onDone }: { tripId: string; fare: number; capacity: number; status: TripStatusCode; onDone: () => void }) {
  const adapter = useAdapter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(fare); const [c, setC] = useState(capacity); const [s, setS] = useState<TripStatusCode>(status);
  if (!open) return <button onClick={() => setOpen(true)} className="btn-ghost px-3 py-1.5 text-xs">Edit</button>;
  return (
    <div className="mt-1 w-full rounded-xl bg-sand-50 p-3">
      <div className="grid grid-cols-3 gap-2">
        <label className="block"><span className="field-label">Fare</span><input type="number" className="input" value={f} onChange={(e) => setF(Number(e.target.value))} /></label>
        <label className="block"><span className="field-label">Capacity</span><input type="number" className="input" value={c} onChange={(e) => setC(Number(e.target.value))} /></label>
        <label className="block"><span className="field-label">Status</span>
          <select className="input" value={s} onChange={(e) => setS(e.target.value as TripStatusCode)}>
            <option value="scheduled">Scheduled</option><option value="boarding">Boarding</option><option value="en_route">En route</option><option value="completed">Completed</option>
          </select></label>
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={() => setOpen(false)} className="btn-ghost flex-1 py-1.5 text-xs">Cancel</button>
        <button onClick={async () => { try { await adapter.operatorUpdateTrip(tripId, { fareUgx: f, capacity: c, status: s }); toast('Updated.', 'ok'); setOpen(false); onDone(); } catch (e) { toast(humanError(e), 'error'); } }} className="btn-primary flex-1 py-1.5 text-xs">Save</button>
      </div>
      <p className="mt-1 text-[11px] text-forest-400">Capacity cannot drop below active reservations; a departure-time change notifies booked passengers.</p>
    </div>
  );
}

function CancelTrip({ tripId, onDone }: { tripId: string; onDone: () => void }) {
  const adapter = useAdapter();
  const toast = useToast();
  const [open, setOpen] = useState(false); const [reason, setReason] = useState('');
  if (!open) return <button onClick={() => setOpen(true)} className="flex items-center gap-1 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600"><XCircle size={14} /> Cancel</button>;
  return (
    <div className="mt-1 w-full rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-red-700"><AlertTriangle size={15} /> Cancel trip (notifies booked passengers)</div>
      <input className="input mt-2" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="mt-2 flex gap-2">
        <button onClick={() => setOpen(false)} className="btn-ghost flex-1 py-1.5 text-xs">Keep</button>
        <button disabled={!reason.trim()} onClick={async () => { try { await adapter.cancelTrip(tripId, reason); toast('Trip cancelled.', 'ok'); setOpen(false); onDone(); } catch (e) { toast(humanError(e), 'error'); } }} className="flex-1 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Confirm</button>
      </div>
    </div>
  );
}

function NewDeparture({ operatorId, routes, vehicles, onCreated }: {
  operatorId: string; routes: RouteRow[]; vehicles: { id: string; label: string }[]; onCreated: () => void;
}) {
  const toast = useToast();
  const [routeId, setRouteId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [fare, setFare] = useState(25000);
  const [capacity, setCapacity] = useState(33);
  const [cutoff, setCutoff] = useState(30);
  const stops = useAsync(() => (routeId ? management.listRouteStops(routeId) : Promise.resolve([])), [routeId]);
  const [times, setTimes] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ordered = [...(stops.data ?? [])].sort((a, b) => a.stop_order - b.stop_order);
    if (ordered.length < 2) { toast('Choose a route with at least 2 stops.', 'error'); return; }
    const pickupTimes = ordered.map((s) => times[s.id]);
    if (pickupTimes.some((t) => !t)) { toast('Set a time for every stop.', 'error'); return; }
    try {
      await management.createDeparture({
        operatorId, routeId, vehicleId: vehicleId || null, serviceDate: pickupTimes[0].slice(0, 10),
        originDeparture: new Date(pickupTimes[0]).toISOString(), fareUgx: fare, capacity, cutoffMinutes: cutoff,
        pickupTimes: pickupTimes.map((t) => new Date(t).toISOString()),
      });
      toast('Departure created.', 'ok'); onCreated();
    } catch (e) { toast(humanError(e), 'error'); }
  }

  const ordered = useMemo(() => [...(stops.data ?? [])].sort((a, b) => a.stop_order - b.stop_order), [stops.data]);

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <h3 className="text-sm font-bold text-forest-800">New departure</h3>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="field-label">Route</span>
          <select className="input" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            <option value="">Select…</option>{routes.map((r) => <option key={r.id} value={r.id}>{r.direction} ({r.origin_city}→{r.destination_city})</option>)}
          </select></label>
        <label className="block"><span className="field-label">Vehicle</span>
          <select className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">(none)</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select></label>
        <label className="block"><span className="field-label">Fare (UGX)</span><input type="number" className="input" value={fare} onChange={(e) => setFare(Number(e.target.value))} /></label>
        <label className="block"><span className="field-label">Capacity</span><input type="number" className="input" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} /></label>
        <label className="block"><span className="field-label">Booking cutoff (min before)</span><input type="number" className="input" value={cutoff} onChange={(e) => setCutoff(Number(e.target.value))} /></label>
      </div>
      {routeId && (
        <div className="space-y-2">
          <div className="field-label">Stop times (local)</div>
          {stops.loading ? <Loading /> : ordered.map((s, i) => (
            <label key={s.id} className="flex items-center gap-2">
              <span className="w-6 text-xs font-bold text-forest-500">{i + 1}</span>
              <input type="datetime-local" className="input" value={times[s.id] ?? ''} onChange={(e) => setTimes({ ...times, [s.id]: e.target.value })} />
            </label>
          ))}
          <p className="text-[11px] text-forest-400">First time is the origin departure; last is the destination arrival.</p>
        </div>
      )}
      <button type="submit" className="btn-primary w-full">Create departure</button>
    </form>
  );
}

// ------------------------------- Fleet -------------------------------
function Fleet({ operatorId }: { operatorId: string }) {
  const toast = useToast();
  const vehicles = useAsync(() => management.listVehicles(operatorId), [operatorId]);
  const [v, setV] = useState({ label: '', plate: '', capacity: 33 });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    try { await management.createVehicle(operatorId, v.label, v.plate, v.capacity); toast('Vehicle added.', 'ok'); setV({ label: '', plate: '', capacity: 33 }); vehicles.reload(); }
    catch (e) { toast(humanError(e), 'error'); }
  }
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-forest-600">Fleet</h2>
      {vehicles.loading && <Loading />}
      {vehicles.error && <ErrorRow message={vehicles.error} onRetry={vehicles.reload} />}
      <div className="space-y-2">
        {(vehicles.data ?? []).map((veh) => (
          <div key={veh.id} className="card flex items-center justify-between p-3.5">
            <div><div className="font-semibold text-forest-900">{veh.label}</div><div className="text-xs text-forest-500">{veh.plate} · {veh.capacity} seats</div></div>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="card grid grid-cols-[1fr_1fr_auto_auto] gap-2 p-3">
        <input className="input" placeholder="Label" value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} />
        <input className="input" placeholder="Plate" value={v.plate} onChange={(e) => setV({ ...v, plate: e.target.value })} />
        <input type="number" className="input w-20" value={v.capacity} onChange={(e) => setV({ ...v, capacity: Number(e.target.value) })} />
        <button className="btn-primary px-3 py-2 text-sm">Add</button>
      </form>
    </div>
  );
}

// ------------------------------- Routes -------------------------------
function Routes({ operatorId }: { operatorId: string }) {
  const toast = useToast();
  const routes = useAsync(() => management.listRoutes(operatorId), [operatorId]);
  const hubs = useAsync(() => management.listHubs(), []);
  const approvedHubs = (hubs.data ?? []).filter((h) => h.approval_status === 'approved' && h.is_active);
  const [dir, setDir] = useState<'KLA_MBR' | 'MBR_KLA'>('KLA_MBR');

  async function createRoute(e: React.FormEvent) {
    e.preventDefault();
    const [o, d] = dir === 'KLA_MBR' ? ['Kampala', 'Mbarara'] : ['Mbarara', 'Kampala'];
    try { await management.createRoute(operatorId, dir, o, d); toast('Route created — now set its stops.', 'ok'); routes.reload(); }
    catch (e) { toast(humanError(e), 'error'); }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-forest-600">Routes &amp; stops</h2>
      {routes.loading && <Loading />}
      {routes.error && <ErrorRow message={routes.error} onRetry={routes.reload} />}
      <div className="space-y-2">
        {(routes.data ?? []).map((r) => <RouteEditor key={r.id} route={r} approvedHubs={approvedHubs} />)}
      </div>
      <form onSubmit={createRoute} className="card grid grid-cols-[1fr_auto] gap-2 p-3">
        <select className="input" value={dir} onChange={(e) => setDir(e.target.value as 'KLA_MBR' | 'MBR_KLA')}>
          <option value="KLA_MBR">Kampala → Mbarara</option><option value="MBR_KLA">Mbarara → Kampala</option>
        </select>
        <button className="btn-primary px-3 py-2 text-sm">Add route</button>
      </form>
      <p className="text-[11px] text-forest-400">Routes may only use approved, active hubs. Approvals are managed by platform admins.</p>
    </div>
  );
}

function RouteEditor({ route, approvedHubs }: { route: RouteRow; approvedHubs: { id: string; name: string; city: string }[] }) {
  const toast = useToast();
  const stops = useAsync(() => management.listRouteStops(route.id), [route.id]);
  const [order, setOrder] = useState<string[]>([]);
  const current = (stops.data ?? []).sort((a, b) => a.stop_order - b.stop_order).map((s) => s.hub_id);
  const chosen = order.length ? order : current;

  async function save() {
    try { await management.setRouteStops(route.id, chosen); toast('Stops updated.', 'ok'); stops.reload(); setOrder([]); }
    catch (e) { toast(humanError(e), 'error'); }
  }
  return (
    <div className="card p-3.5">
      <div className="font-semibold text-forest-900">{route.direction} <span className="text-xs text-forest-400">({route.origin_city}→{route.destination_city})</span></div>
      <div className="mt-1 text-xs text-forest-500">Stops: {chosen.map((id) => approvedHubs.find((h) => h.id === id)?.name ?? '—').join(' → ') || 'none set'}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {approvedHubs.map((h) => {
          const idx = chosen.indexOf(h.id);
          return (
            <button key={h.id} onClick={() => setOrder(idx >= 0 ? chosen.filter((x) => x !== h.id) : [...chosen, h.id])}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${idx >= 0 ? 'bg-forest-700 text-white' : 'bg-forest-50 text-forest-600'}`}>
              {idx >= 0 ? `${idx + 1}. ` : ''}{h.name}
            </button>
          );
        })}
      </div>
      <button onClick={save} className="btn-primary mt-2 px-3 py-1.5 text-xs">Save stops</button>
    </div>
  );
}

// ------------------------------- Team -------------------------------
function Team({ operatorId }: { operatorId: string }) {
  const toast = useToast();
  const trips = useAsync(() => management.listOperatorTrips(operatorId), [operatorId]);
  const [tripId, setTripId] = useState('');
  const [userId, setUserId] = useState('');
  async function assign(e: React.FormEvent) {
    e.preventDefault();
    try { await management.assignConductor(tripId, userId.trim()); toast('Conductor assigned.', 'ok'); setUserId(''); }
    catch (e) { toast(humanError(e), 'error'); }
  }
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-forest-600">Assign conductors</h2>
      <StaffNote>Hub attendants are assigned by platform admins (hubs are platform records). Operators assign conductors to their own trips.</StaffNote>
      <form onSubmit={assign} className="card space-y-2 p-4">
        <label className="block"><span className="field-label">Trip</span>
          <select className="input" value={tripId} onChange={(e) => setTripId(e.target.value)}>
            <option value="">Select…</option>
            {(trips.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.direction} · {formatDate(t.service_date)} {formatTime(t.origin_departure)}</option>)}
          </select></label>
        <label className="block"><span className="field-label">Conductor user id (UUID)</span>
          <input className="input font-mono" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="00000000-…" /></label>
        <button type="submit" disabled={!tripId} className="btn-primary w-full">Assign conductor</button>
      </form>
    </div>
  );
}

// ------------------------------- Incidents -------------------------------
function Incidents({ operatorId }: { operatorId: string }) {
  const toast = useToast();
  const incidents = useAsync(() => management.listIncidents(), [operatorId]);
  const trips = useAsync(() => management.listOperatorTrips(operatorId), [operatorId]);
  const [form, setForm] = useState({ kind: 'breakdown', tripId: '', staffNotes: '', passengerMessage: '' });

  async function report(e: React.FormEvent) {
    e.preventDefault();
    try {
      await management.reportIncident({ kind: form.kind, tripId: form.tripId || undefined, staffNotes: form.staffNotes || undefined, passengerMessage: form.passengerMessage || undefined });
      toast('Incident reported.', 'ok'); setForm({ kind: 'breakdown', tripId: '', staffNotes: '', passengerMessage: '' }); incidents.reload();
    } catch (e) { toast(humanError(e), 'error'); }
  }
  async function resolve(id: string) {
    const r = prompt('Resolution note:'); if (r === null) return;
    try { await management.resolveIncident(id, r || 'Resolved'); toast('Resolved.', 'ok'); incidents.reload(); }
    catch (e) { toast(humanError(e), 'error'); }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-forest-600">Incidents</h2>
      <StaffNote>Staff notes are private to operations. The passenger message is what affected passengers may see.</StaffNote>
      <form onSubmit={report} className="card space-y-2 p-4">
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="field-label">Type</span>
            <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="breakdown">Breakdown</option><option value="missed_pickup">Missed pickup</option>
              <option value="left_unboarded">Left unboarded</option><option value="hub_unavailable">Hub unavailable</option><option value="other">Other</option>
            </select></label>
          <label className="block"><span className="field-label">Trip (optional)</span>
            <select className="input" value={form.tripId} onChange={(e) => setForm({ ...form, tripId: e.target.value })}>
              <option value="">(none)</option>{(trips.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.direction} {formatDate(t.service_date)}</option>)}
            </select></label>
        </div>
        <label className="block"><span className="field-label">Private staff note</span><textarea className="input min-h-[54px]" value={form.staffNotes} onChange={(e) => setForm({ ...form, staffNotes: e.target.value })} /></label>
        <label className="block"><span className="field-label">Passenger message (optional)</span><input className="input" value={form.passengerMessage} onChange={(e) => setForm({ ...form, passengerMessage: e.target.value })} /></label>
        <button type="submit" className="btn-primary w-full">Report incident</button>
      </form>
      {incidents.loading && <Loading />}
      {incidents.error && <ErrorRow message={incidents.error} onRetry={incidents.reload} />}
      <div className="space-y-2">
        {(incidents.data ?? []).map((i) => (
          <div key={i.id} className="card p-3.5">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-forest-900 capitalize">{i.kind.replace(/_/g, ' ')}</div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${i.status === 'resolved' ? 'bg-forest-200 text-forest-800' : 'bg-amber-100 text-amber-800'}`}>{i.status}</span>
            </div>
            {i.staff_notes && <div className="mt-1 text-xs text-forest-600">Note: {i.staff_notes}</div>}
            {i.resolution && <div className="mt-1 text-xs text-forest-500">Resolution: {i.resolution}</div>}
            {i.status !== 'resolved' && <button onClick={() => resolve(i.id)} className="btn-ghost mt-2 px-3 py-1.5 text-xs"><CheckCircle2 size={14} /> Resolve</button>}
          </div>
        ))}
        {(incidents.data?.length ?? 0) === 0 && !incidents.loading && <p className="rounded-xl bg-white p-4 text-sm text-forest-500 shadow-card">No incidents.</p>}
      </div>
    </div>
  );
}
