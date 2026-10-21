import { useEffect, useMemo, useState } from 'react';
import { PlayCircle, TimerReset, Flag, MapPin, Navigation, RefreshCw } from 'lucide-react';
import { useAdapter } from '../../../data/AdapterProvider';
import { useToast } from '../../../components/ToastProvider';
import { useAsync, humanError } from '../hooks';
import { Loading, ErrorRow, StaffNote } from '../parts';
import { TripStatusPill } from '../../../components/StatusPill';
import { LocationSharing } from './ConductorWorkspace';
import { formatDate, formatTime } from '../../../lib/time';
import type { ManifestRow } from '../../../data/adapter';

/** Driver workspace: the trips you're rostered to drive, their progress controls,
 *  passenger counts, and live location sharing. Boarding is the conductor's job, so
 *  there is no credential scanning here. */
export function DriverWorkspace({ tripIds }: { tripIds: string[] }) {
  const adapter = useAdapter();
  const [tripId, setTripId] = useState(tripIds[0] ?? '');
  const trips = useAsync(() => Promise.all(tripIds.map((id) => adapter.getTrip(id))), [tripIds.join(',')]);

  if (!tripId) return <p className="text-forest-500">You have no trips rostered to drive.</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-900">Driver</h1>
        <StaffNote>You can only run trips you are rostered to drive. The conductor boards passengers; you drive and report progress.</StaffNote>
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
      <DriverConsole key={tripId} tripId={tripId} />
    </div>
  );
}

function DriverConsole({ tripId }: { tripId: string }) {
  const adapter = useAdapter();
  const toast = useToast();
  const trip = useAsync(() => adapter.getTrip(tripId), [tripId]);
  const manifest = useAsync(() => adapter.getTripManifest(tripId), [tripId]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sub = adapter.subscribeTrip(tripId, () => { trip.reload(); manifest.reload(); });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const rows = useMemo(() => manifest.data ?? [], [manifest.data]);
  const seats = (pred: (r: ManifestRow) => boolean) => rows.filter(pred).reduce((n, r) => n + r.seats, 0);

  async function run(fn: () => Promise<unknown>, ok: string) {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(ok, 'ok'); trip.reload(); manifest.reload(); }
    catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }

  const t = trip.data;
  const nextStop = t?.stops.slice().sort((a, b) => a.stopOrder - b.stopOrder).find((s) => !s.reached);
  const active = t?.status === 'en_route' || t?.status === 'boarding';

  return (
    <div className="space-y-4">
      {trip.loading && <Loading />}
      {trip.error && <ErrorRow message={trip.error} onRetry={trip.reload} />}
      {t && (
        <>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-forest-900">{t.operatorName}</div>
                <div className="text-xs text-forest-500">{t.direction} · {t.vehicleLabel ?? 'Vehicle TBD'}</div>
              </div>
              <TripStatusPill status={t.status} delayed={t.delayMinutes > 0} />
            </div>

            {nextStop ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-forest-50 px-3 py-2 text-sm text-forest-700">
                <Navigation size={15} /> Next pickup: <span className="font-semibold">{nextStop.hubName}</span>
                <span className="text-forest-400">· {formatTime(nextStop.pickupTime)}</span>
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-forest-50 px-3 py-2 text-sm text-forest-600">All stops reached.</div>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Count label="Expected" value={seats((r) => r.status !== 'boarded' && r.status !== 'completed')} />
              <Count label="Checked in" value={seats((r) => r.status === 'checked_in')} tone="lime" />
              <Count label="Boarded" value={seats((r) => r.status === 'boarded' || r.status === 'completed')} />
            </div>
            <p className="mt-2 text-[11px] text-forest-400">Counts are passenger seats. Boarding is confirmed by the conductor.</p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button disabled={busy || t.status !== 'scheduled'} onClick={() => run(() => adapter.updateTripStatus(tripId, 'en_route'), 'Trip started.')} className="btn-ghost text-xs disabled:opacity-50"><PlayCircle size={15} /> Start trip</button>
              <button disabled={busy || t.status === 'completed'} onClick={() => run(() => adapter.reportDelay(tripId, 15), 'Delay +15m recorded.')} className="btn-ghost text-xs disabled:opacity-50"><TimerReset size={15} /> Report delay +15m</button>
              {nextStop && (
                <button disabled={busy} onClick={() => run(() => adapter.reachHub(tripId, nextStop.hubId), `Reached ${nextStop.hubName}.`)} className="btn-ghost col-span-2 text-xs disabled:opacity-50">
                  <MapPin size={15} /> Reached {nextStop.hubName}
                </button>
              )}
              <button disabled={busy || t.status === 'completed'} onClick={() => run(() => adapter.updateTripStatus(tripId, 'completed'), 'Trip completed.')} className="btn-ghost col-span-2 text-xs disabled:opacity-50"><Flag size={15} /> Complete journey</button>
            </div>
          </div>

          <LocationSharing tripId={tripId} tripActive={active} />

          <div className="flex items-center justify-end">
            <button onClick={() => { trip.reload(); manifest.reload(); }} className="text-forest-400"><RefreshCw size={15} /></button>
          </div>
        </>
      )}
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone?: 'lime' }) {
  return (
    <div className={`rounded-xl py-2 ${tone === 'lime' ? 'bg-lime-100' : 'bg-forest-50'}`}>
      <div className="text-xl font-extrabold text-forest-800">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-forest-500">{label}</div>
    </div>
  );
}
