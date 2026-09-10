import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Flag,
  CheckCircle2,
  Clock,
  Wallet,
  QrCode,
  XCircle,
  PlayCircle,
  TimerReset,
  Info,
} from 'lucide-react';
import { useStore } from '../../state/store';
import { useToast } from '../../components/ToastProvider';
import { hubById, operatorById, vehicleById, DIRECTION_LABEL } from '../../lib/lookup';
import { formatDate, formatTime, formatUGX, shiftMinutes } from '../../lib/time';
import { effectivePickupTime, effectiveArrival } from '../../state/logic';
import { QRCodeImage } from '../../components/QRCode';
import { RouteSchematic } from '../../components/RouteSchematic';
import { BookingStatusPill, TripStatusPill } from '../../components/StatusPill';
import { DemoNote } from '../../components/ui';

export function TripDetail() {
  const { bookingId = '' } = useParams();
  const { state, checkIn, cancelBooking, advanceBus, reportDelay } = useStore();
  const toast = useToast();
  const navigate = useNavigate();

  const booking = state.bookings.find((b) => b.id === bookingId);
  const trip = booking ? state.trips.find((t) => t.id === booking.tripId) : undefined;

  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!booking || !trip) {
    return (
      <div className="space-y-3">
        <Link to="/trips" className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600">
          <ArrowLeft size={16} /> My Trips
        </Link>
        <p className="text-forest-600">Booking not found.</p>
      </div>
    );
  }

  const op = operatorById(state, trip.operatorId);
  const vehicle = vehicleById(state, trip.vehicleId);
  const pickupHub = hubById(state, booking.pickupHubId);
  const destCity = trip.direction === 'KLA_MBR' ? 'Mbarara' : 'Kampala';
  const destHub = state.hubs.find((h) => h.city === destCity);
  const pickup = effectivePickupTime(trip, booking.pickupHubId);
  const recommendedArrival = pickup ? shiftMinutes(pickup, -15) : undefined;

  const canCheckIn =
    booking.status === 'reserved' && trip.status !== 'cancelled' && trip.status !== 'completed';
  const canCancel =
    (booking.status === 'reserved' || booking.status === 'checked_in') &&
    trip.status !== 'completed';

  function doCheckIn() {
    const r = checkIn(booking!.id);
    if (r.ok) toast("You're checked in — see you at the hub!", 'ok');
    else toast(r.error, 'error');
  }
  function doCancel() {
    const r = cancelBooking(booking!.id);
    if (r.ok) {
      toast('Reservation cancelled — seats returned.', 'ok');
      setConfirmCancel(false);
    } else toast(r.error, 'error');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/trips')}
          className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600"
        >
          <ArrowLeft size={16} /> My Trips
        </button>
        <BookingStatusPill status={booking.status} />
      </div>

      {trip.status === 'cancelled' && (
        <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
          This trip was cancelled{trip.cancelReason ? `: ${trip.cancelReason}` : ''}. Your seats have
          been released.
        </div>
      )}
      {booking.status === 'missed_pickup' && (
        <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
          You checked in but were not boarded before the trip completed. Operations is investigating and
          will follow up.
        </div>
      )}
      {booking.status === 'not_boarded' && (
        <div className="rounded-xl bg-sand-50 px-3 py-2.5 text-sm text-forest-700 ring-1 ring-forest-100">
          This trip has completed and you were not boarded, so you were not recorded as having travelled.
        </div>
      )}

      {/* Boarding pass */}
      <div className="overflow-hidden rounded-2xl bg-forest-700 text-white shadow-raised">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-lime-200">Boarding pass</div>
            <div className="text-lg font-extrabold">{DIRECTION_LABEL[trip.direction]}</div>
          </div>
          <TripStatusPill status={trip.status} delayed={trip.delayMinutes > 0} />
        </div>

        <div className="grid grid-cols-2 gap-px bg-white/10 text-sm">
          <PassCell label="Operator" value={op?.name ?? '—'} />
          <PassCell label="Date" value={formatDate(trip.date)} />
          <PassCell label="Pickup hub" value={pickupHub?.name ?? '—'} />
          <PassCell label="Pickup time" value={pickup ? formatTime(pickup) : '—'} />
          <PassCell label="Passengers" value={String(booking.seats)} />
          <PassCell label="Vehicle" value={vehicle?.label ?? '—'} />
        </div>

        {/* QR + code */}
        <div className="flex items-center gap-4 border-t border-white/10 bg-white px-4 py-4 text-forest-900">
          <div className="rounded-xl bg-white p-1 ring-1 ring-forest-100">
            <QRCodeImage value={`TOGO:${booking.reference}:${booking.boardingCode}`} size={112} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-forest-400">Boarding code</div>
            <div className="font-mono text-4xl font-extrabold tracking-[0.2em] text-forest-900">
              {booking.boardingCode}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wide text-forest-400">Reference</div>
            <div className="font-mono text-lg font-bold text-forest-700">{booking.reference}</div>
          </div>
        </div>

        {/* Fare */}
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
          <span className="flex items-center gap-1.5 text-sm text-forest-100">
            <Wallet size={15} /> Pay at boarding
          </span>
          <span className="font-bold">{formatUGX(trip.farePerSeat * booking.seats)}</span>
        </div>
      </div>

      <p className="flex items-center justify-center gap-1 text-center text-[11px] text-forest-400">
        <QrCode size={12} /> Show this code to the conductor when boarding.
      </p>

      {/* Check-in */}
      {canCheckIn && (
        <div className="card space-y-3 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-forest-600">Check in</h2>
          <p className="text-sm text-forest-600">
            When you reach <strong>{pickupHub?.name}</strong>, tap below so the hub attendant and
            conductor know you’re waiting.
          </p>
          <DemoNote>Check-in is simulated — ToGo does not request your GPS or location.</DemoNote>
          <button onClick={doCheckIn} className="btn-accent w-full">
            <CheckCircle2 size={18} /> I’m at the hub
          </button>
        </div>
      )}

      {booking.status === 'checked_in' && (
        <div className="card space-y-2 p-4">
          <div className="flex items-center gap-2 text-forest-700">
            <CheckCircle2 size={18} className="text-lime-500" />
            <span className="font-semibold">You’re checked in and waiting</span>
          </div>
          <p className="text-sm text-forest-600">
            Stay near the ToGo signpost at <strong>{pickupHub?.name}</strong>. Have your boarding code
            ready — the conductor will confirm you on arrival.
          </p>
          {booking.unresolved && (
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
              The bus recorded an unresolved pickup at your hub. Please contact the attendant.
            </div>
          )}
        </div>
      )}

      {booking.status === 'boarded' && (
        <div className="card flex items-center gap-2 p-4 text-forest-700">
          <CheckCircle2 size={18} className="text-blue-500" />
          <span className="font-semibold">Boarded — enjoy your trip!</span>
        </div>
      )}

      {/* Journey recap */}
      <div className="card p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-forest-600">Journey</h2>
        <div className="space-y-1">
          <Recap
            icon={<MapPin size={15} />}
            title={pickupHub?.name ?? 'Pickup'}
            time={pickup ? formatTime(pickup) : '—'}
            accent
          />
          <div className="ml-[14px] flex items-center gap-2 py-1 text-xs text-forest-400">
            <Clock size={12} />
            Recommended arrival {recommendedArrival ? formatTime(recommendedArrival) : '—'} (15 min early)
          </div>
          <Recap
            icon={<Flag size={15} />}
            title={destHub?.name ?? destCity}
            time={formatTime(effectiveArrival(trip))}
          />
        </div>
      </div>

      {/* Simulated tracking */}
      {booking.status !== 'cancelled' && trip.status !== 'cancelled' && (
        <div className="space-y-2">
          <RouteSchematic state={state} trip={trip} />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => advanceBus(trip.id)}
              disabled={trip.status === 'completed'}
              className="btn-ghost"
            >
              <PlayCircle size={16} /> Advance bus
            </button>
            <button
              onClick={() => {
                const r = reportDelay(trip.id, 15);
                if (r.ok) toast('Simulated a 15 min delay.', 'ok');
              }}
              disabled={trip.status === 'completed'}
              className="btn-ghost"
            >
              <TimerReset size={16} /> Simulate delay
            </button>
          </div>
          <p className="flex items-center justify-center gap-1 text-center text-[11px] text-forest-400">
            <Info size={11} /> Demo controls — advance the bus or add a delay to see the app update.
          </p>
        </div>
      )}

      {/* Cancel */}
      {canCancel && (
        <div className="pt-2">
          {confirmCancel ? (
            <div className="card space-y-3 p-4">
              <p className="text-sm font-semibold text-forest-800">
                Cancel this reservation? Your {booking.seats} seat{booking.seats === 1 ? '' : 's'} will
                be returned to availability.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmCancel(false)} className="btn-ghost flex-1">
                  Keep it
                </button>
                <button
                  onClick={doCancel}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white active:scale-[0.98]"
                >
                  Cancel reservation
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmCancel(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white py-3 text-sm font-semibold text-red-600"
            >
              <XCircle size={16} /> Cancel reservation
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PassCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-forest-700 px-4 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-forest-100/70">{label}</div>
      <div className="truncate font-semibold">{value}</div>
    </div>
  );
}

function Recap({
  icon,
  title,
  time,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  time: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          accent ? 'bg-lime-400 text-forest-900' : 'bg-forest-100 text-forest-700'
        }`}
      >
        {icon}
      </span>
      <span className="flex-1 truncate font-semibold text-forest-900">{title}</span>
      <span className="font-bold text-forest-900">{time}</span>
    </div>
  );
}
