import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Search, Clock, Users, ChevronRight } from 'lucide-react';
import { useAdapter } from '../../../data/AdapterProvider';
import { useAsync } from '../hooks';
import { Loading, ErrorRow } from '../parts';
import { EmptyState, SectionHeading } from '../../../components/ui';
import { BookingStatusPill, TripStatusPill } from '../../../components/StatusPill';
import { formatUGX, formatTime, formatDate, kampalaToday } from '../../../lib/time';
import type { BookingView, DirectionCode } from '../../../data/adapter';

export function PassengerHome() {
  const adapter = useAdapter();
  const navigate = useNavigate();
  const [direction, setDirection] = useState<DirectionCode>('KLA_MBR');
  const [date, setDate] = useState(kampalaToday());
  const [pax, setPax] = useState(1);
  const [hubId, setHubId] = useState<string | null>(null);

  const hubs = useAsync(() => adapter.listHubs(), []);
  const trips = useAsync(() => adapter.searchTrips({ direction, date, hubId }), [direction, date, hubId]);
  const bookings = useAsync(() => adapter.myBookings(), []);

  const originCity = direction === 'KLA_MBR' ? 'Kampala' : 'Mbarara';
  const destCity = direction === 'KLA_MBR' ? 'Mbarara' : 'Kampala';
  const originHubs = useMemo(() => (hubs.data ?? []).filter((h) => h.city === originCity), [hubs.data, originCity]);

  const upcoming = (bookings.data ?? []).filter((b) => ['reserved', 'checked_in', 'boarded'].includes(b.status));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-900">Find your hub. Meet your bus.</h1>
        <p className="mt-1 text-sm text-forest-500">Reserve a seat, check in at a pickup hub, and board with a code.</p>
      </div>

      {upcoming.length > 0 && (
        <section>
          <SectionHeading title="Upcoming trip" />
          <TripRow booking={upcoming[0]} onOpen={() => navigate(`/trips/${upcoming[0].id}`)} />
        </section>
      )}

      <div className="card space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1"><div className="field-label">From</div><div className="text-lg font-bold text-forest-900">{originCity}</div></div>
          <button aria-label="Switch direction" onClick={() => { setDirection((d) => (d === 'KLA_MBR' ? 'MBR_KLA' : 'KLA_MBR')); setHubId(null); }}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-forest-200 bg-forest-50 text-forest-700"><ArrowLeftRight size={18} /></button>
          <div className="flex-1 text-right"><div className="field-label">To</div><div className="text-lg font-bold text-forest-900">{destCity}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="field-label" htmlFor="d">Date</label>
            <input id="d" type="date" className="input" value={date} min={kampalaToday()} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className="field-label" htmlFor="p"><Users size={12} className="mr-1 inline" />Passengers</label>
            <select id="p" className="input" value={pax} onChange={(e) => setPax(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select></div>
        </div>
        <div>
          <div className="field-label">Pickup hub</div>
          {hubs.loading ? <Loading /> : hubs.error ? <ErrorRow message={hubs.error} onRetry={hubs.reload} /> : (
            <div className="grid gap-2">
              <button onClick={() => setHubId(null)} className={`rounded-xl border px-3 py-2 text-left text-sm ${!hubId ? 'border-forest-600 bg-forest-50' : 'border-forest-200'}`}>Any hub</button>
              {originHubs.map((h) => (
                <button key={h.id} onClick={() => setHubId(h.id)} className={`rounded-xl border px-3 py-2 text-left ${hubId === h.id ? 'border-forest-600 bg-forest-50' : 'border-forest-200'}`}>
                  <span className="block text-sm font-semibold text-forest-900">{h.name}</span>
                  <span className="block text-xs text-forest-500">{h.area}</span>
                </button>
              ))}
              {originHubs.length === 0 && <p className="text-xs text-forest-400">No approved hubs in this city yet.</p>}
            </div>
          )}
        </div>
      </div>

      <section>
        <SectionHeading title="Departures" />
        {trips.loading && <Loading />}
        {trips.error && <ErrorRow message={trips.error} onRetry={trips.reload} />}
        {trips.data && trips.data.length === 0 && (
          <EmptyState icon={<Search size={32} />} title="No departures match">Try another date, switch direction, or clear the hub.</EmptyState>
        )}
        <div className="space-y-2">
          {trips.data?.map((t) => {
            const stops = [...t.stops].sort((a, b) => a.stopOrder - b.stopOrder);
            const pickup = stops.find((s) => s.hubId === hubId) ?? stops[0];
            const enough = t.seatsAvailable >= pax;
            return (
              <div key={t.id} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-forest-50 px-4 py-2.5">
                  <div className="text-sm font-bold text-forest-900">{t.operatorName}</div>
                  <TripStatusPill status={t.status} delayed={t.delayMinutes > 0} />
                </div>
                <div className="grid grid-cols-3 gap-1 px-4 py-3 text-center">
                  <TimeCol label="Departs origin" time={formatTime(t.originDeparture)} />
                  <TimeCol label="Your pickup" time={pickup ? formatTime(pickup.pickupTime) : '—'} sub={pickup?.hubName.split(' ')[0]} highlight />
                  <TimeCol label="Arrives" time={formatTime(t.destinationArrival)} />
                </div>
                <div className="flex items-center justify-between border-t border-forest-50 px-4 py-3">
                  <div className="text-xs text-forest-500">
                    <span className={enough ? '' : 'font-semibold text-red-600'}>{t.seatsAvailable} seat{t.seatsAvailable === 1 ? '' : 's'} left</span>
                  </div>
                  <div className="text-right"><div className="text-lg font-extrabold text-forest-900">{formatUGX(t.fareUgx)}</div><div className="text-[10px] text-forest-400">per passenger</div></div>
                  {enough
                    ? <button onClick={() => navigate(`/book/${t.id}?hub=${pickup?.hubId ?? ''}&pax=${pax}`)} className="btn-primary px-4 py-2.5 text-sm">Select</button>
                    : <span className="rounded-xl bg-sand-100 px-4 py-2.5 text-sm font-semibold text-forest-400">Full</span>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="pt-2 text-center text-[11px] text-forest-400"><Clock size={11} className="mr-1 inline" />Origin departure differs from your hub pickup time. Times in Africa/Kampala.</p>
      </section>

      {(bookings.data?.length ?? 0) > 0 && (
        <section>
          <SectionHeading title="My trips" />
          <div className="space-y-2">
            {bookings.data!.map((b) => <TripRow key={b.id} booking={b} onOpen={() => navigate(`/trips/${b.id}`)} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function TripRow({ booking, onOpen }: { booking: BookingView; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="card flex w-full items-center justify-between p-3.5 text-left active:scale-[0.99]">
      <div>
        <div className="font-semibold text-forest-900">{booking.reference}</div>
        <div className="text-xs text-forest-500">
          {booking.seats} seat{booking.seats === 1 ? '' : 's'} · {formatUGX(booking.fareUgxSnapshot * booking.seats)} · {formatDate(booking.pickupTimeSnapshot.slice(0, 10))} {formatTime(booking.pickupTimeSnapshot)}
        </div>
        <div className="mt-1"><BookingStatusPill status={booking.status} /></div>
      </div>
      <ChevronRight size={18} className="text-forest-300" />
    </button>
  );
}

function TimeCol({ label, time, sub, highlight }: { label: string; time: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl py-1 ${highlight ? 'bg-lime-50' : ''}`}>
      <div className={`text-base font-bold ${highlight ? 'text-forest-800' : 'text-forest-700'}`}>{time}</div>
      <div className="text-[10px] uppercase tracking-wide text-forest-400">{label}</div>
      {sub && <div className="truncate text-[10px] text-forest-500">{sub}</div>}
    </div>
  );
}
