import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight, Search, Loader2, ArrowLeft, Wallet, CheckCircle2, XCircle,
  MapPin, Clock, RefreshCw, Bell,
} from 'lucide-react';
import { useAdapter } from '../../../data/AdapterProvider';
import { useToast } from '../../../components/ToastProvider';
import { useAsync, humanError } from '../hooks';
import { QRCodeImage } from '../../../components/QRCode';
import { BookingStatusPill, TripStatusPill } from '../../../components/StatusPill';
import { EmptyState, SectionHeading } from '../../../components/ui';
import { formatUGX, formatTime, formatDate, kampalaToday, timeAgo } from '../../../lib/time';
import type { BookingView, DirectionCode, TripView } from '../../../data/adapter';

const DIR_LABEL: Record<DirectionCode, string> = {
  KLA_MBR: 'Kampala → Mbarara',
  MBR_KLA: 'Mbarara → Kampala',
};

export function PassengerWorkspace() {
  const adapter = useAdapter();
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);

  // My bookings with realtime refresh.
  const bookings = useAsync(() => adapter.myBookings(), []);
  useEffect(() => {
    const sub = adapter.subscribeMyBookings(() => bookings.reload());
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (selectedBooking) {
    return (
      <BookingDetail
        bookingId={selectedBooking}
        onBack={() => { setSelectedBooking(null); bookings.reload(); }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <MyBookings state={bookings} onOpen={setSelectedBooking} />
      <NotificationsCard />
      <SearchAndBook onBooked={(id) => { bookings.reload(); setSelectedBooking(id); }} />
    </div>
  );
}

function MyBookings({
  state, onOpen,
}: { state: ReturnType<typeof useAsync<BookingView[]>>; onOpen: (id: string) => void }) {
  return (
    <section>
      <SectionHeading title="My trips" action={
        <button onClick={state.reload} className="text-forest-400"><RefreshCw size={15} /></button>
      } />
      {state.loading && <Loading />}
      {state.error && <ErrorRow message={state.error} onRetry={state.reload} />}
      {state.data && state.data.length === 0 && (
        <EmptyState title="No trips yet">Reserve a seat below and it appears here.</EmptyState>
      )}
      <div className="space-y-2">
        {state.data?.map((b) => (
          <button key={b.id} onClick={() => onOpen(b.id)}
            className="card flex w-full items-center justify-between p-3.5 text-left active:scale-[0.99]">
            <div>
              <div className="font-semibold text-forest-900">{b.reference}</div>
              <div className="text-xs text-forest-500">
                {b.seats} seat{b.seats === 1 ? '' : 's'} · {formatUGX(b.fareUgxSnapshot * b.seats)} · pickup {formatTime(b.pickupTimeSnapshot)}
              </div>
            </div>
            <BookingStatusPill status={b.status} />
          </button>
        ))}
      </div>
    </section>
  );
}

function SearchAndBook({ onBooked }: { onBooked: (bookingId: string) => void }) {
  const adapter = useAdapter();
  const [direction, setDirection] = useState<DirectionCode>('KLA_MBR');
  const [date, setDate] = useState(kampalaToday());
  const [hubId, setHubId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TripView | null>(null);

  const hubs = useAsync(() => adapter.listHubs(), []);
  const trips = useAsync(() => adapter.searchTrips({ direction, date, hubId }), [direction, date, hubId]);

  const originHubs = useMemo(() => {
    const city = direction === 'KLA_MBR' ? 'Kampala' : 'Mbarara';
    return (hubs.data ?? []).filter((h) => h.city === city);
  }, [hubs.data, direction]);

  if (selected) {
    return <ReservePanel trip={selected} preferredHubId={hubId} onBack={() => setSelected(null)} onBooked={onBooked} />;
  }

  return (
    <section>
      <SectionHeading title="Find buses" />
      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-lg font-bold text-forest-900">
            {direction === 'KLA_MBR' ? 'Kampala' : 'Mbarara'}
          </div>
          <button onClick={() => { setDirection((d) => (d === 'KLA_MBR' ? 'MBR_KLA' : 'KLA_MBR')); setHubId(null); }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-forest-200 bg-forest-50 text-forest-700">
            <ArrowLeftRight size={16} />
          </button>
          <div className="text-lg font-bold text-forest-900">
            {direction === 'KLA_MBR' ? 'Mbarara' : 'Kampala'}
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="cdate">Date</label>
          <input id="cdate" type="date" className="input" value={date} min={kampalaToday()}
            onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <div className="field-label">Pickup hub</div>
          {hubs.loading ? <Loading /> : (
            <div className="grid gap-2">
              <button onClick={() => setHubId(null)}
                className={`rounded-xl border px-3 py-2 text-left text-sm ${!hubId ? 'border-forest-600 bg-forest-50' : 'border-forest-200'}`}>
                Any hub
              </button>
              {originHubs.map((h) => (
                <button key={h.id} onClick={() => setHubId(h.id)}
                  className={`rounded-xl border px-3 py-2 text-left ${hubId === h.id ? 'border-forest-600 bg-forest-50' : 'border-forest-200'}`}>
                  <span className="block text-sm font-semibold text-forest-900">{h.name}</span>
                  <span className="block text-xs text-forest-500">{h.area}</span>
                </button>
              ))}
              {originHubs.length === 0 && (
                <p className="text-xs text-forest-400">No approved hubs in this city yet.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {trips.loading && <Loading />}
        {trips.error && <ErrorRow message={trips.error} onRetry={trips.reload} />}
        {trips.data && trips.data.length === 0 && (
          <EmptyState icon={<Search size={32} />} title="No departures match">Try another date or hub.</EmptyState>
        )}
        {trips.data?.map((t) => (
          <div key={t.id} className="card p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-forest-900">{t.operatorName}</div>
                <div className="text-xs text-forest-500">{DIR_LABEL[t.direction]} · {formatDate(t.serviceDate)}</div>
              </div>
              <TripStatusPill status={t.status} delayed={t.delayMinutes > 0} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-forest-500">
                Depart {formatTime(t.originDeparture)} · {t.seatsAvailable} seat{t.seatsAvailable === 1 ? '' : 's'} left
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-forest-900">{formatUGX(t.fareUgx)}</span>
                <button disabled={t.seatsAvailable < 1} onClick={() => setSelected(t)}
                  className="btn-primary px-3 py-2 text-sm disabled:opacity-50">
                  {t.seatsAvailable < 1 ? 'Full' : 'Select'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReservePanel({
  trip, preferredHubId, onBack, onBooked,
}: { trip: TripView; preferredHubId: string | null; onBack: () => void; onBooked: (id: string) => void }) {
  const adapter = useAdapter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [seats, setSeats] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // One idempotency key per reserve attempt — stable across accidental double clicks.
  const [idemKey] = useState(() => crypto.randomUUID());

  const stops = [...trip.stops].sort((a, b) => a.stopOrder - b.stopOrder);
  const pickup = stops.find((s) => s.hubId === preferredHubId) ?? stops[0];
  const dropoff = stops[stops.length - 1];

  async function confirm() {
    if (busy) return;
    setErr(null);
    setBusy(true);
    try {
      const booking = await adapter.reserve({
        tripId: trip.id, pickupStopId: pickup.id, dropoffStopId: dropoff.id,
        seats, passengerName: name.trim() || 'Traveller', passengerPhone: phone.trim() || undefined,
        idempotencyKey: idemKey,
      });
      toast(`Reserved — ${booking.reference}`, 'ok');
      onBooked(booking.id);
    } catch (e) {
      setErr(humanError(e));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600">
        <ArrowLeft size={16} /> Back
      </button>
      <h2 className="text-xl font-extrabold text-forest-900">Review & reserve</h2>
      <div className="card space-y-1 p-4">
        <div className="font-bold text-forest-900">{trip.operatorName}</div>
        <div className="text-sm text-forest-500">{DIR_LABEL[trip.direction]} · {formatDate(trip.serviceDate)}</div>
        <div className="mt-2 flex items-center gap-2 text-sm text-forest-700">
          <MapPin size={14} /> Pickup {pickup.hubName} · {formatTime(pickup.pickupTime)}
        </div>
      </div>
      <div className="card space-y-3 p-4">
        <label className="block"><span className="field-label">Lead passenger name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Amina N." /></label>
        <label className="block"><span className="field-label">Phone (optional)</span>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256 7xx" inputMode="tel" /></label>
        <label className="block"><span className="field-label">Passengers</span>
          <select className="input" value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
            {Array.from({ length: Math.min(5, trip.seatsAvailable) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select></label>
      </div>
      <div className="card flex items-start gap-3 p-4">
        <Wallet size={18} className="mt-0.5 text-forest-700" />
        <div>
          <div className="font-semibold text-forest-900">Reserve — pay at boarding</div>
          <div className="text-xs text-forest-500">No payment is collected now.</div>
        </div>
      </div>
      {err && <ErrorRow message={err} onRetry={confirm} />}
      <div className="card flex items-center justify-between p-4">
        <div>
          <div className="text-xs uppercase text-forest-400">Total</div>
          <div className="text-2xl font-extrabold text-forest-900">{formatUGX(trip.fareUgx * seats)}</div>
        </div>
        <button onClick={confirm} disabled={busy} className="btn-primary">
          {busy && <Loader2 size={16} className="animate-spin" />} Confirm reservation
        </button>
      </div>
    </div>
  );
}

function BookingDetail({ bookingId, onBack }: { bookingId: string; onBack: () => void }) {
  const adapter = useAdapter();
  const toast = useToast();
  const booking = useAsync(() => adapter.getBooking(bookingId), [bookingId]);
  const [busy, setBusy] = useState(false);

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
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600">
        <ArrowLeft size={16} /> My trips
      </button>
      {booking.loading && <Loading />}
      {booking.error && <ErrorRow message={booking.error} onRetry={booking.reload} />}
      {b && (
        <>
          <div className="overflow-hidden rounded-2xl bg-forest-700 text-white shadow-raised">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-lime-200">Boarding pass</div>
                <div className="text-lg font-extrabold">{trip.data ? DIR_LABEL[trip.data.direction] : b.reference}</div>
              </div>
              <BookingStatusPill status={b.status} />
            </div>
            <div className="flex items-center gap-4 bg-white px-4 py-4 text-forest-900">
              <div className="rounded-xl bg-white p-1 ring-1 ring-forest-100">
                <QRCodeImage value={`TOGO:${b.boardingCredential}`} size={112} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase text-forest-400">Reference</div>
                <div className="font-mono text-2xl font-extrabold text-forest-900">{b.reference}</div>
                <div className="mt-1 text-xs text-forest-500">{b.seats} passenger{b.seats === 1 ? '' : 's'}</div>
                <div className="text-xs text-forest-500">Pickup {formatTime(b.pickupTimeSnapshot)}</div>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="flex items-center gap-1.5 text-sm text-forest-100"><Wallet size={15} /> Pay at boarding</span>
              <span className="font-bold">{formatUGX(b.fareUgxSnapshot * b.seats)}</span>
            </div>
          </div>
          <p className="text-center text-[11px] text-forest-400">
            The QR carries an opaque credential — no personal data. Only your conductor can validate it.
          </p>

          {/* Live location freshness (no geographic position invented) */}
          {trip.data && (trip.data.status === 'en_route' || trip.data.status === 'boarding') && (
            <div className="card p-4">
              <div className="mb-1 flex items-center gap-2 text-sm font-bold text-forest-700">
                <MapPin size={15} /> Live location
              </div>
              {location.data ? (
                <p className="text-sm text-forest-600">
                  Last update {timeAgo(location.data.receivedAt)}
                  {Date.now() - new Date(location.data.receivedAt).getTime() > 120000 && (
                    <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Stale</span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-forest-500">
                  No live location yet. Sharing works only while a staff device keeps the app open — this is a scheduled estimate, not GPS navigation.
                </p>
              )}
            </div>
          )}

          {b.status === 'reserved' && (
            <button disabled={busy} onClick={() => act(() => adapter.checkIn(b.id), "You're checked in")}
              className="btn-accent w-full">
              <CheckCircle2 size={18} /> I'm at the hub (check in)
            </button>
          )}
          {(b.status === 'reserved' || b.status === 'checked_in') && (
            <button disabled={busy} onClick={() => act(() => adapter.cancelBooking(b.id), 'Reservation cancelled')}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white py-3 text-sm font-semibold text-red-600">
              <XCircle size={16} /> Cancel reservation
            </button>
          )}
        </>
      )}
    </div>
  );
}

function NotificationsCard() {
  const adapter = useAdapter();
  const notifs = useAsync(() => adapter.listNotifications(), []);
  if (!notifs.data || notifs.data.length === 0) return null;
  return (
    <section>
      <SectionHeading title="Notifications" />
      <ul className="card divide-y divide-forest-50">
        {notifs.data.slice(0, 6).map((n) => (
          <li key={n.id} className="flex items-start gap-2 px-4 py-2.5">
            <Bell size={14} className={`mt-1 shrink-0 ${n.readAt ? 'text-forest-300' : 'text-lime-500'}`} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-forest-800">{n.title}</div>
              <div className="text-xs text-forest-500">{n.body}</div>
              <div className="text-[10px] text-forest-400">{timeAgo(n.createdAt)}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Loading() {
  return <div className="flex justify-center py-6 text-forest-400"><Loader2 className="animate-spin" /></div>;
}
function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
      <span className="flex items-center gap-1.5"><Clock size={14} /> {message}</span>
      <button onClick={onRetry} className="font-semibold underline">Retry</button>
    </div>
  );
}
