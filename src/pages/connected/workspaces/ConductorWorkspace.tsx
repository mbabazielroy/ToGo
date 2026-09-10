import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PlayCircle, TimerReset, Flag, Search, CheckCircle2, AlertTriangle, RefreshCw, MapPin, Radio,
} from 'lucide-react';
import { useAdapter } from '../../../data/AdapterProvider';
import { useToast } from '../../../components/ToastProvider';
import { useAsync, humanError } from '../hooks';
import { Loading, ErrorRow, StaffNote } from '../parts';
import { TripStatusPill, BookingStatusPill } from '../../../components/StatusPill';
import { formatDate, formatTime } from '../../../lib/time';
import type { ManifestRow } from '../../../data/adapter';

export function ConductorWorkspace({ tripIds }: { tripIds: string[] }) {
  const adapter = useAdapter();
  const [tripId, setTripId] = useState(tripIds[0] ?? '');
  const trips = useAsync(() => Promise.all(tripIds.map((id) => adapter.getTrip(id))), [tripIds.join(',')]);

  if (!tripId) return <p className="text-forest-500">You have no assigned trips.</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-900">Conductor</h1>
        <StaffNote>You can only manage trips you are assigned to. Boarding validates opaque credentials.</StaffNote>
      </div>
      <label className="block"><span className="field-label">Trip</span>
        <select className="input" value={tripId} onChange={(e) => setTripId(e.target.value)}>
          {(trips.data ?? []).filter(Boolean).map((t) => (
            <option key={t!.id} value={t!.id}>
              {t!.operatorName} · {t!.direction} · {formatDate(t!.serviceDate)} {formatTime(t!.originDeparture)}
            </option>
          ))}
        </select>
      </label>
      <TripConsole key={tripId} tripId={tripId} />
    </div>
  );
}

function TripConsole({ tripId }: { tripId: string }) {
  const adapter = useAdapter();
  const toast = useToast();
  const trip = useAsync(() => adapter.getTrip(tripId), [tripId]);
  const manifest = useAsync(() => adapter.getTripManifest(tripId), [tripId]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [departHub, setDepartHub] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const sub = adapter.subscribeTrip(tripId, () => { trip.reload(); manifest.reload(); });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const rows = useMemo(() => manifest.data ?? [], [manifest.data]);
  const seats = (pred: (r: ManifestRow) => boolean) => rows.filter(pred).reduce((n, r) => n + r.seats, 0);

  const byHub = useMemo(() => {
    const m = new Map<string, ManifestRow[]>();
    for (const r of rows) { const a = m.get(r.pickupHubId) ?? []; a.push(r); m.set(r.pickupHubId, a); }
    return m;
  }, [rows]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(ok, 'ok'); trip.reload(); manifest.reload(); }
    catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }

  async function board(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    // Accept a scanned "TOGO:<cred>" or a raw credential.
    const cred = code.trim().replace(/^TOGO:/, '');
    await run(() => adapter.boardByCredential(tripId, cred), 'Boarded.');
    setCode('');
  }

  function tryDepart(hubId: string) {
    const unboarded = (byHub.get(hubId) ?? []).filter((r) => r.status === 'checked_in');
    if (unboarded.length > 0) { setDepartHub(hubId); setReason(''); }
    else run(() => adapter.reachHub(tripId, hubId), 'Marked reached.');
  }

  const t = trip.data;

  return (
    <div className="space-y-4">
      {trip.loading && <Loading />}
      {trip.error && <ErrorRow message={trip.error} onRetry={trip.reload} />}
      {t && (
        <>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="font-bold text-forest-900">{t.operatorName}</div>
              <TripStatusPill status={t.status} delayed={t.delayMinutes > 0} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-forest-50 py-2">
                <div className="text-xl font-extrabold text-forest-800">{seats((r) => r.status !== 'boarded')}</div>
                <div className="text-[10px] uppercase text-forest-500">Expected pax</div>
              </div>
              <div className="rounded-xl bg-lime-100 py-2">
                <div className="text-xl font-extrabold text-forest-900">{seats((r) => r.status === 'checked_in')}</div>
                <div className="text-[10px] uppercase text-forest-600">Checked in</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button disabled={busy} onClick={() => run(() => adapter.updateTripStatus(tripId, 'en_route'), 'Trip started.')} className="btn-ghost text-xs"><PlayCircle size={15} /> Start</button>
              <button disabled={busy} onClick={() => run(() => adapter.reportDelay(tripId, 15), 'Delay +15m.')} className="btn-ghost text-xs"><TimerReset size={15} /> Delay</button>
              <button disabled={busy} onClick={() => run(() => adapter.updateTripStatus(tripId, 'completed'), 'Trip completed.')} className="btn-ghost text-xs"><Flag size={15} /> Complete</button>
            </div>
          </div>

          <LocationSharing tripId={tripId} tripActive={t.status === 'en_route' || t.status === 'boarding'} />

          <form onSubmit={board} className="card flex gap-2 p-4">
            <input className="input flex-1 font-mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Scan or type boarding credential" />
            <button type="submit" disabled={busy} className="btn-primary px-4 py-3 text-sm"><Search size={16} /> Board</button>
          </form>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-forest-600">Manifest</h2>
            <button onClick={() => { trip.reload(); manifest.reload(); }} className="text-forest-400"><RefreshCw size={15} /></button>
          </div>
          {t.stops.sort((a, b) => a.stopOrder - b.stopOrder).map((s) => {
            const list = byHub.get(s.hubId) ?? [];
            return (
              <div key={s.id} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-forest-50 px-4 py-2.5">
                  <div className="text-sm font-bold text-forest-900"><MapPin size={12} className="mr-1 inline" />{s.hubName}</div>
                  <div className="text-[11px] text-forest-500">{list.reduce((n, r) => n + (r.status === 'checked_in' ? r.seats : 0), 0)} checked in</div>
                </div>
                {list.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-forest-400">No passengers at this hub.</div>
                ) : (
                  <ul className="divide-y divide-forest-50">
                    {list.map((r) => (
                      <li key={r.bookingId} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <div className="text-sm font-semibold text-forest-900">{r.passengerName}</div>
                          <div className="flex items-center gap-1.5 text-[11px] text-forest-500">
                            <span className="font-mono">{r.reference}</span> · {r.seats} pax <BookingStatusPill status={r.status} />
                          </div>
                        </div>
                        {r.status === 'boarded'
                          ? <span className="flex items-center gap-1 text-xs font-semibold text-blue-600"><CheckCircle2 size={14} /> Boarded</span>
                          : <span className="text-[11px] text-forest-400">Board by code</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {!s.reached && t.status !== 'completed' && (
                  <div className="border-t border-forest-50 px-4 py-2.5">
                    <button onClick={() => tryDepart(s.hubId)} className="w-full rounded-xl bg-forest-100 py-2 text-sm font-semibold text-forest-700">
                      Bus reached / leaving this hub
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {departHub && t && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-raised">
            <div className="flex items-center gap-2 text-amber-700"><AlertTriangle size={20} /><h3 className="text-lg font-bold">Checked-in passengers not boarded</h3></div>
            <p className="mt-2 text-sm text-forest-600">Leaving now records an unresolved pickup. Please give a reason.</p>
            <textarea className="input mt-3 min-h-[72px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Passenger not present" />
            <div className="mt-3 flex gap-2">
              <button onClick={() => setDepartHub(null)} className="btn-ghost flex-1">Go back</button>
              <button disabled={!reason.trim()} onClick={async () => {
                await run(async () => { await adapter.recordUnresolvedPickup(tripId, departHub, reason); await adapter.reachHub(tripId, departHub); }, 'Recorded unresolved pickup.');
                setDepartHub(null);
              }} className="flex-1 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Record & leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ShareState = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'interrupted';

function LocationSharing({ tripId, tripActive }: { tripId: string; tripActive: boolean }) {
  const adapter = useAdapter();
  const [state, setState] = useState<ShareState>('idle');
  const watchId = useRef<number | null>(null);
  const lastSent = useRef(0);

  const stop = () => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setState('idle');
  };

  // Stop sharing when the trip is no longer active or the component unmounts.
  useEffect(() => {
    if (!tripActive && state === 'active') stop();
    return () => { if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripActive]);

  function start() {
    if (!('geolocation' in navigator)) { setState('unavailable'); return; }
    setState('requesting');
    // Permission is requested only now, after an explicit user action.
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState('active');
        const now = Date.now();
        if (now - lastSent.current < 6000) return; // client-side throttle
        lastSent.current = now;
        adapter.reportLocation(
          tripId, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy,
          new Date(pos.timestamp).toISOString(),
        ).catch(() => { /* server throttle/validation — ignore transient */ });
      },
      (err) => { setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'interrupted'); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }

  const label: Record<ShareState, string> = {
    idle: 'Location sharing is off', requesting: 'Requesting location…', active: 'Sharing your location',
    denied: 'Permission denied', unavailable: 'Location unavailable on this device', interrupted: 'Sharing interrupted',
  };

  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-bold text-forest-700"><Radio size={15} /> Live location</div>
      <p className="mb-2 text-xs text-forest-500">
        Foreground only — works while this page stays open. No background tracking, and no ETA is computed from distance.
      </p>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${state === 'active' ? 'text-forest-700' : state === 'denied' || state === 'unavailable' ? 'text-red-600' : 'text-forest-500'}`}>
          {label[state]}
        </span>
        {state === 'active' || state === 'requesting'
          ? <button onClick={stop} className="btn-ghost px-3 py-2 text-xs">Stop sharing</button>
          : <button disabled={!tripActive} onClick={start} className="btn-primary px-3 py-2 text-xs disabled:opacity-50">Start sharing</button>}
      </div>
    </div>
  );
}
