import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Flag, Wallet, Check, Users, ShieldCheck } from 'lucide-react';
import { useStore } from '../../state/store';
import { useSearch } from '../../state/search';
import { useToast } from '../../components/ToastProvider';
import { hubById, operatorById, vehicleById, DIRECTION_LABEL } from '../../lib/lookup';
import { formatDate, formatTime, formatUGX } from '../../lib/time';
import { availableSeats, effectivePickupTime, effectiveArrival } from '../../state/logic';

export function Booking() {
  const { tripId = '' } = useParams();
  const { state, reserve } = useStore();
  const { criteria } = useSearch();
  const toast = useToast();
  const navigate = useNavigate();

  const trip = state.trips.find((t) => t.id === tripId);
  const [name, setName] = useState(state.profile.name);
  const [phone, setPhone] = useState(state.profile.phone);
  const [seats, setSeats] = useState(Math.min(criteria.passengers, 5));
  const [submitting, setSubmitting] = useState(false);

  if (!trip) {
    return (
      <div className="space-y-3">
        <Link to="/search" className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600">
          <ArrowLeft size={16} /> Back
        </Link>
        <p className="text-forest-600">This trip is no longer available.</p>
      </div>
    );
  }

  const op = operatorById(state, trip.operatorId);
  const vehicle = vehicleById(state, trip.vehicleId);
  const pickupHubId = criteria.hubId && trip.stops.some((s) => s.hubId === criteria.hubId)
    ? criteria.hubId
    : trip.stops[0].hubId;
  const pickupHub = hubById(state, pickupHubId);
  const destHubId = trip.stops[trip.stops.length - 1].hubId;
  // Destination city hub: pick the central hub of the destination city for illustration.
  const destCity = trip.direction === 'KLA_MBR' ? 'Mbarara' : 'Kampala';
  const destHub = state.hubs.find((h) => h.city === destCity) ?? hubById(state, destHubId);
  const available = availableSeats(state, trip);
  const total = trip.farePerSeat * seats;
  const pickup = effectivePickupTime(trip, pickupHubId);

  function confirm() {
    if (submitting) return; // guard repeated clicks
    setSubmitting(true);
    const result = reserve({
      tripId: trip!.id,
      pickupHubId,
      passengerName: name,
      phone,
      seats,
    });
    if (result.ok) {
      toast(`Reserved — ${result.value.reference}`, 'ok');
      navigate(`/trips/${result.value.id}`);
    } else {
      toast(result.error, 'error');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600"
      >
        <ArrowLeft size={16} /> Back to results
      </button>

      <h1 className="text-2xl font-extrabold text-forest-900">Review & reserve</h1>

      {/* Trip summary */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-forest-900">{op?.name}</div>
            <div className="text-xs text-forest-400">{vehicle?.label} · {vehicle?.plate}</div>
          </div>
          <div className="text-right text-xs text-forest-500">{formatDate(trip.date)}</div>
        </div>
        <div className="mt-2 text-sm font-semibold text-forest-700">
          {DIRECTION_LABEL[trip.direction]}
        </div>
      </div>

      {/* Pickup & destination */}
      <div className="card p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-forest-600">Your journey</h2>
        <div className="space-y-3">
          <JourneyRow
            icon={<MapPin size={16} />}
            tone="accent"
            title={pickupHub?.name ?? 'Pickup hub'}
            sub={pickupHub?.area}
            time={pickup ? formatTime(pickup) : '—'}
            timeLabel="Pickup"
          />
          <div className="ml-[15px] h-5 border-l-2 border-dashed border-forest-200" />
          <JourneyRow
            icon={<Flag size={16} />}
            title={destHub?.name ?? destCity}
            sub={destHub?.area}
            time={formatTime(effectiveArrival(trip))}
            timeLabel="Arrive"
          />
        </div>
      </div>

      {/* Passenger details */}
      <div className="card space-y-3 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-forest-600">Passenger details</h2>
        <div>
          <label className="field-label" htmlFor="name">Lead passenger name</label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Amina N."
            autoComplete="name"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="phone">Phone (optional, demo)</label>
          <input
            id="phone"
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+256 7xx xxx xxx"
            inputMode="tel"
          />
        </div>
        <div>
          <label className="field-label">
            <Users size={12} className="mr-1 inline" /> Passengers
          </label>
          <div className="flex items-center gap-3">
            <Stepper
              value={seats}
              min={1}
              max={Math.max(1, Math.min(5, available))}
              onChange={setSeats}
            />
            <span className="text-xs text-forest-500">{available} available</span>
          </div>
        </div>
      </div>

      {/* Payment */}
      <div className="card p-4">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-forest-600">Payment</h2>
        <div className="flex items-start gap-3 rounded-xl bg-forest-50 p-3 ring-1 ring-forest-200">
          <Wallet size={18} className="mt-0.5 shrink-0 text-forest-700" />
          <div>
            <div className="font-semibold text-forest-900">Reserve — pay at boarding</div>
            <div className="text-xs text-forest-500">
              No payment is collected now. This is a demo reservation only.
            </div>
          </div>
          <Check size={18} className="ml-auto mt-0.5 shrink-0 text-forest-700" />
        </div>
      </div>

      {/* Total + confirm */}
      <div className="sticky bottom-24 space-y-2">
        <div className="card flex items-center justify-between p-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-forest-400">Total ({seats} × {formatUGX(trip.farePerSeat)})</div>
            <div className="text-2xl font-extrabold text-forest-900">{formatUGX(total)}</div>
          </div>
          <button onClick={confirm} disabled={submitting || available < 1} className="btn-primary">
            {submitting ? 'Reserving…' : 'Confirm reservation'}
          </button>
        </div>
        <p className="flex items-center justify-center gap-1 text-center text-[11px] text-forest-400">
          <ShieldCheck size={12} /> Demo reservation — no money changes hands and pickup is not guaranteed.
        </p>
      </div>
    </div>
  );
}

function JourneyRow({
  icon,
  title,
  sub,
  time,
  timeLabel,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  time: string;
  timeLabel: string;
  tone?: 'accent';
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          tone === 'accent' ? 'bg-lime-400 text-forest-900' : 'bg-forest-100 text-forest-700'
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-forest-900">{title}</div>
        {sub && <div className="truncate text-xs text-forest-500">{sub}</div>}
      </div>
      <div className="text-right">
        <div className="font-bold text-forest-900">{time}</div>
        <div className="text-[10px] uppercase tracking-wide text-forest-400">{timeLabel}</div>
      </div>
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-forest-200 bg-white p-1">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-50 text-lg font-bold text-forest-700 disabled:opacity-40"
        aria-label="Fewer passengers"
      >
        −
      </button>
      <span className="w-6 text-center text-lg font-bold text-forest-900">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-50 text-lg font-bold text-forest-700 disabled:opacity-40"
        aria-label="More passengers"
      >
        +
      </button>
    </div>
  );
}
