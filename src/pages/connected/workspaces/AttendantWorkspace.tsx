import { useEffect, useState } from 'react';
import { Search, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAdapter } from '../../../data/AdapterProvider';
import { useToast } from '../../../components/ToastProvider';
import { useAsync, humanError } from '../hooks';
import { Loading, ErrorRow, StaffNote } from '../parts';
import { StatCard } from '../../../components/ui';
import { BookingStatusPill } from '../../../components/StatusPill';
import { formatTime } from '../../../lib/time';

export function AttendantWorkspace({ hubIds }: { hubIds: string[] }) {
  const adapter = useAdapter();
  const toast = useToast();
  const [hubId, setHubId] = useState(hubIds[0] ?? '');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);

  const hubs = useAsync(() => adapter.listHubs(), []);
  const expected = useAsync(() => (hubId ? adapter.getHubExpected(hubId) : Promise.resolve([])), [hubId]);

  useEffect(() => {
    if (!hubId) return;
    const sub = adapter.subscribeMyBookings(() => expected.reload());
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubId]);

  const rows = expected.data ?? [];
  const seatSum = (pred: (s: string) => boolean) =>
    rows.filter((r) => pred(r.status)).reduce((n, r) => n + r.seats, 0);

  async function checkIn(reference: string) {
    setBusy(true);
    try { await adapter.checkInByReference(reference); toast('Checked in.', 'ok'); setRef(''); expected.reload(); }
    catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }

  const myHubs = (hubs.data ?? []).filter((h) => hubIds.includes(h.id));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-900">Hub attendant</h1>
        <StaffNote>You see only bookings at hubs you are assigned to. Counts are passenger quantities.</StaffNote>
      </div>

      <label className="block"><span className="field-label">Hub</span>
        <select className="input" value={hubId} onChange={(e) => setHubId(e.target.value)}>
          {myHubs.map((h) => <option key={h.id} value={h.id}>{h.name} — {h.city}</option>)}
          {myHubs.length === 0 && <option value="">No hub assignments</option>}
        </select>
      </label>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Expected" value={seatSum((s) => s === 'reserved' || s === 'checked_in')} />
        <StatCard label="Checked in" value={seatSum((s) => s === 'checked_in')} tone="accent" />
        <StatCard label="Boarded" value={seatSum((s) => s === 'boarded')} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (ref.trim()) checkIn(ref); }} className="card flex gap-2 p-4">
        <input className="input flex-1 font-mono uppercase" value={ref} onChange={(e) => setRef(e.target.value)}
          placeholder="TG-XXXX" />
        <button type="submit" disabled={busy} className="btn-primary px-4 py-3 text-sm"><Search size={16} /> Check in</button>
      </form>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-forest-600">Expected passengers</h2>
        <button onClick={expected.reload} className="text-forest-400"><RefreshCw size={15} /></button>
      </div>
      {expected.loading && <Loading />}
      {expected.error && <ErrorRow message={expected.error} onRetry={expected.reload} />}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.bookingId} className="card flex items-center justify-between p-3.5">
            <div>
              <div className="font-semibold text-forest-900">{r.passengerName}</div>
              <div className="text-xs text-forest-500">
                <span className="font-mono">{r.reference}</span> · {r.seats} pax · pickup {formatTime(r.pickupTime)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BookingStatusPill status={r.status} />
              {r.status === 'reserved' && (
                <button disabled={busy} onClick={() => checkIn(r.reference)} className="btn-accent px-3 py-1.5 text-xs">
                  <CheckCircle2 size={14} /> Check in
                </button>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && !expected.loading && (
          <p className="rounded-xl bg-white p-4 text-sm text-forest-500 shadow-card">No expected passengers right now.</p>
        )}
      </div>
    </div>
  );
}
