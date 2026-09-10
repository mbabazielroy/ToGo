import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Wallet, CheckCircle2, XCircle, MapPin, QrCode } from 'lucide-react';
import { useAdapter } from '../../../data/AdapterProvider';
import { useToast } from '../../../components/ToastProvider';
import { useAsync, humanError } from '../hooks';
import { Loading, ErrorRow } from '../parts';
import { QRCodeImage } from '../../../components/QRCode';
import { TripStatusPill } from '../../../components/StatusPill';
import { formatUGX, formatTime, formatDate, timeAgo } from '../../../lib/time';

export function TripDetailPage() {
  const { bookingId = '' } = useParams();
  const adapter = useAdapter();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const booking = useAsync(() => adapter.getBooking(bookingId), [bookingId]);
  const b = booking.data;
  const trip = useAsync(() => (b ? adapter.getTrip(b.tripId) : Promise.resolve(null)), [b?.tripId]);
  const location = useAsync(() => (b ? adapter.latestLocation(b.tripId) : Promise.resolve(null)), [b?.tripId]);

  useEffect(() => {
    if (!b) return;
    const sub = adapter.subscribeTrip(b.tripId, () => { booking.reload(); trip.reload(); location.reload(); });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b?.tripId]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(ok, 'ok'); booking.reload(); }
    catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(false); setConfirmCancel(false); }
  }

  const t = trip.data;
  const stale = location.data && Date.now() - new Date(location.data.receivedAt).getTime() > 120000;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/')} className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600"><ArrowLeft size={16} /> My trips</button>
      {booking.loading && <Loading />}
      {booking.error && <ErrorRow message={booking.error} onRetry={booking.reload} />}
      {b && (
        <>
          {b.status === 'cancelled' && (
            <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-200">This reservation was cancelled and the seats released.</div>
          )}
          {b.status === 'missed_pickup' && (
            <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">You checked in but were not boarded before the trip completed. Our operations team is investigating and will follow up.</div>
          )}
          {(b.status === 'not_boarded' || b.status === 'no_show') && (
            <div className="rounded-xl bg-sand-50 px-3 py-2.5 text-sm text-forest-700 ring-1 ring-forest-100">This trip has completed and you were not boarded, so you were not recorded as having travelled.</div>
          )}

          <div className="overflow-hidden rounded-2xl bg-forest-700 text-white shadow-raised">
            <div className="flex items-center justify-between px-4 py-3">
              <div><div className="text-[11px] uppercase tracking-widest text-lime-200">Boarding pass</div>
                <div className="text-lg font-extrabold">{t ? `${t.operatorName}` : b.reference}</div></div>
              {t && <TripStatusPill status={t.status} delayed={t.delayMinutes > 0} />}
            </div>
            <div className="flex items-center gap-4 bg-white px-4 py-4 text-forest-900">
              <div className="rounded-xl bg-white p-1 ring-1 ring-forest-100">
                <QRCodeImage value={`TOGO:${b.boardingCredential}`} size={112} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase text-forest-400">Reference</div>
                <div className="font-mono text-2xl font-extrabold text-forest-900">{b.reference}</div>
                <div className="mt-1 text-xs text-forest-500">{b.seats} passenger{b.seats === 1 ? '' : 's'}</div>
                <div className="text-xs text-forest-500">{formatDate(b.pickupTimeSnapshot.slice(0, 10))} · pickup {formatTime(b.pickupTimeSnapshot)}</div>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="flex items-center gap-1.5 text-sm text-forest-100"><Wallet size={15} /> Pay at boarding</span>
              <span className="font-bold">{formatUGX(b.fareUgxSnapshot * b.seats)}</span>
            </div>
          </div>
          <p className="flex items-center justify-center gap-1 text-center text-[11px] text-forest-400"><QrCode size={12} /> The QR carries an opaque credential — no personal data. Only your conductor can validate it.</p>

          {t && (t.status === 'en_route' || t.status === 'boarding') && (
            <div className="card p-4">
              <div className="mb-1 flex items-center gap-2 text-sm font-bold text-forest-700"><MapPin size={15} /> Live location</div>
              {location.data ? (
                <p className="text-sm text-forest-600">Last update {timeAgo(location.data.receivedAt)}
                  {stale && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Stale</span>}</p>
              ) : (
                <p className="text-sm text-forest-500">No live location yet. Sharing works only while a staff device keeps the app open — this is a scheduled estimate, not GPS navigation.</p>
              )}
            </div>
          )}

          {b.status === 'reserved' && (
            <div className="card space-y-2 p-4">
              <p className="text-sm text-forest-600">When you reach your hub, tap below so the attendant and conductor know you're waiting. Check-in is simulated — no GPS is requested.</p>
              <button disabled={busy} onClick={() => act(() => adapter.checkIn(b.id), "You're checked in")} className="btn-accent w-full"><CheckCircle2 size={18} /> I'm at the hub (check in)</button>
            </div>
          )}
          {b.status === 'checked_in' && (
            <div className="card flex items-center gap-2 p-4 text-forest-700"><CheckCircle2 size={18} className="text-lime-500" /><span className="font-semibold">Checked in and waiting — have your code ready.</span></div>
          )}
          {b.status === 'boarded' && (
            <div className="card flex items-center gap-2 p-4 text-forest-700"><CheckCircle2 size={18} className="text-blue-500" /><span className="font-semibold">Boarded — safe travels!</span></div>
          )}

          {(b.status === 'reserved' || b.status === 'checked_in') && (
            confirmCancel ? (
              <div className="card space-y-3 p-4">
                <p className="text-sm font-semibold text-forest-800">Cancel this reservation? Your seats will be released.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmCancel(false)} className="btn-ghost flex-1">Keep it</button>
                  <button disabled={busy} onClick={() => act(() => adapter.cancelBooking(b.id), 'Reservation cancelled')} className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white">Cancel reservation</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmCancel(true)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white py-3 text-sm font-semibold text-red-600"><XCircle size={16} /> Cancel reservation</button>
            )
          )}
          <div className="text-center"><Link to="/notifications" className="text-xs font-semibold text-forest-500">View notifications →</Link></div>
        </>
      )}
    </div>
  );
}
