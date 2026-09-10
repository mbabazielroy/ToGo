import { useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Flag, Wallet, Loader2 } from 'lucide-react';
import { useAdapter } from '../../../data/AdapterProvider';
import { useToast } from '../../../components/ToastProvider';
import { useAsync, humanError } from '../hooks';
import { Loading, ErrorRow } from '../parts';
import { formatUGX, formatTime, formatDate } from '../../../lib/time';

export function BookPage() {
  const { tripId = '' } = useParams();
  const [params] = useSearchParams();
  const preferredHub = params.get('hub');
  const initialPax = Math.max(1, Math.min(5, Number(params.get('pax') || 1)));

  const adapter = useAdapter();
  const toast = useToast();
  const navigate = useNavigate();
  const trip = useAsync(() => adapter.getTrip(tripId), [tripId]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [seats, setSeats] = useState(initialPax);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [idemKey] = useState(() => crypto.randomUUID());

  const t = trip.data;
  const stops = t ? [...t.stops].sort((a, b) => a.stopOrder - b.stopOrder) : [];
  const pickup = stops.find((s) => s.hubId === preferredHub) ?? stops[0];
  const dropoff = stops[stops.length - 1];

  async function confirm() {
    if (busy || !t || !pickup || !dropoff) return;
    setErr(null); setBusy(true);
    try {
      const booking = await adapter.reserve({
        tripId: t.id, pickupStopId: pickup.id, dropoffStopId: dropoff.id,
        seats, passengerName: name.trim() || 'Traveller', passengerPhone: phone.trim() || undefined,
        idempotencyKey: idemKey,
      });
      toast(`Reserved — ${booking.reference}`, 'ok');
      navigate(`/trips/${booking.id}`, { replace: true });
    } catch (e) {
      setErr(humanError(e)); setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600"><ArrowLeft size={16} /> Back to search</Link>
      <h1 className="text-2xl font-extrabold text-forest-900">Review &amp; reserve</h1>
      {trip.loading && <Loading />}
      {trip.error && <ErrorRow message={trip.error} onRetry={trip.reload} />}
      {t && pickup && dropoff && (
        <>
          <div className="card space-y-1 p-4">
            <div className="font-bold text-forest-900">{t.operatorName}</div>
            <div className="text-sm text-forest-500">{formatDate(t.serviceDate)} · departs origin {formatTime(t.originDeparture)}</div>
          </div>
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-forest-600">Your journey</h2>
            <Row icon={<MapPin size={16} />} accent title={pickup.hubName} sub={pickup.hubCity} time={formatTime(pickup.pickupTime)} timeLabel="Pickup" />
            <div className="ml-[15px] my-1 h-4 border-l-2 border-dashed border-forest-200" />
            <Row icon={<Flag size={16} />} title={dropoff.hubName} sub={dropoff.hubCity} time={formatTime(dropoff.pickupTime)} timeLabel="Arrive" />
          </div>
          <div className="card space-y-3 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-forest-600">Passenger details</h2>
            <label className="block"><span className="field-label">Lead passenger name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Amina N." autoComplete="name" /></label>
            <label className="block"><span className="field-label">Phone (optional)</span>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256 7xx" inputMode="tel" /></label>
            <label className="block"><span className="field-label">Passengers</span>
              <select className="input" value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
                {Array.from({ length: Math.max(1, Math.min(5, t.seatsAvailable)) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="mt-1 block text-xs text-forest-400">{t.seatsAvailable} seat{t.seatsAvailable === 1 ? '' : 's'} available</span>
            </label>
          </div>
          <div className="card p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-forest-600">Fare</h2>
            <div className="space-y-1 text-sm text-forest-700">
              <div className="flex justify-between"><span>Fare per passenger</span><span>{formatUGX(t.fareUgx)}</span></div>
              <div className="flex justify-between"><span>Passengers</span><span>× {seats}</span></div>
              <div className="mt-1 flex justify-between border-t border-forest-100 pt-2 text-base font-extrabold text-forest-900"><span>Total</span><span>{formatUGX(t.fareUgx * seats)}</span></div>
            </div>
            <div className="mt-3 flex items-start gap-3 rounded-xl bg-forest-50 p-3 ring-1 ring-forest-200">
              <Wallet size={18} className="mt-0.5 text-forest-700" />
              <div><div className="font-semibold text-forest-900">Reserve — pay at boarding</div><div className="text-xs text-forest-500">No payment is collected now.</div></div>
            </div>
          </div>
          {err && <ErrorRow message={err} onRetry={confirm} />}
          <button onClick={confirm} disabled={busy || t.seatsAvailable < 1} className="btn-primary w-full">
            {busy && <Loader2 size={16} className="animate-spin" />} Confirm reservation
          </button>
          <p className="text-center text-[11px] text-forest-400">Demo pilot reservation — no money changes hands and pickup is not guaranteed.</p>
        </>
      )}
    </div>
  );
}

function Row({ icon, title, sub, time, timeLabel, accent }: {
  icon: React.ReactNode; title: string; sub?: string; time: string; timeLabel: string; accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${accent ? 'bg-lime-400 text-forest-900' : 'bg-forest-100 text-forest-700'}`}>{icon}</span>
      <div className="min-w-0 flex-1"><div className="truncate font-semibold text-forest-900">{title}</div>{sub && <div className="truncate text-xs text-forest-500">{sub}</div>}</div>
      <div className="text-right"><div className="font-bold text-forest-900">{time}</div><div className="text-[10px] uppercase tracking-wide text-forest-400">{timeLabel}</div></div>
    </div>
  );
}
