import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bus, Clock, MapPin, Users, SearchX } from 'lucide-react';
import { useStore } from '../../state/store';
import { useSearch } from '../../state/search';
import { hubById, operatorById, vehicleById, DIRECTION_LABEL } from '../../lib/lookup';
import { formatDate, formatTime, formatUGX } from '../../lib/time';
import { availableSeats, effectivePickupTime, effectiveArrival } from '../../state/logic';
import { EmptyState } from '../../components/ui';
import { TripStatusPill } from '../../components/StatusPill';

export function SearchResults() {
  const { state } = useStore();
  const { criteria } = useSearch();
  const navigate = useNavigate();

  const hub = criteria.hubId ? hubById(state, criteria.hubId) : null;

  const results = state.trips
    .filter((t) => t.direction === criteria.direction)
    .filter((t) => t.date === criteria.date)
    .filter((t) => (criteria.hubId ? t.stops.some((s) => s.hubId === criteria.hubId) : true))
    .filter((t) => t.status !== 'cancelled' && t.status !== 'completed')
    .sort((a, b) => a.originDeparture.localeCompare(b.originDeparture));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-forest-700 shadow-card"
          aria-label="Back to search"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-extrabold leading-tight text-forest-900">
            {DIRECTION_LABEL[criteria.direction]}
          </h1>
          <p className="text-xs text-forest-500">
            {formatDate(criteria.date)} · {criteria.passengers} passenger
            {criteria.passengers > 1 ? 's' : ''}
            {hub ? ` · ${hub.name}` : ' · all hubs'}
          </p>
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState icon={<SearchX size={40} />} title="No departures match">
          Try another date, switch the direction, or clear the pickup hub to see every departure.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {results.map((t) => {
            const op = operatorById(state, t.operatorId);
            const vehicle = vehicleById(state, t.vehicleId);
            const seats = availableSeats(state, t);
            const pickupHubId = criteria.hubId ?? t.stops[0].hubId;
            const pickup = effectivePickupTime(t, pickupHubId);
            const pickupHub = hubById(state, pickupHubId);
            const enough = seats >= criteria.passengers;
            return (
              <div key={t.id} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-forest-50 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-100 text-forest-700">
                      <Bus size={16} />
                    </span>
                    <div>
                      <div className="text-sm font-bold text-forest-900">{op?.name}</div>
                      <div className="text-[11px] text-forest-400">{vehicle?.label}</div>
                    </div>
                  </div>
                  <TripStatusPill status={t.status} delayed={t.delayMinutes > 0} />
                </div>

                <div className="grid grid-cols-3 gap-1 px-4 py-3 text-center">
                  <TimeCol label="Departs origin" time={formatTime(t.originDeparture)} />
                  <TimeCol
                    label="Your pickup"
                    time={pickup ? formatTime(pickup) : '—'}
                    highlight
                    sub={pickupHub?.name.split(' ')[0]}
                  />
                  <TimeCol label="Arrives" time={formatTime(effectiveArrival(t))} />
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-forest-50 px-4 py-3">
                  <div className="text-xs text-forest-500">
                    <div className="flex items-center gap-1">
                      <Users size={12} />
                      <span className={enough ? '' : 'font-semibold text-red-600'}>
                        {seats} seat{seats === 1 ? '' : 's'} left
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1">
                      <MapPin size={12} /> {pickupHub?.city}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-extrabold text-forest-900">{formatUGX(t.farePerSeat)}</div>
                    <div className="text-[10px] text-forest-400">per passenger</div>
                  </div>
                  {enough ? (
                    <Link to={`/book/${t.id}`} className="btn-primary px-4 py-2.5 text-sm">
                      Select
                    </Link>
                  ) : (
                    <span className="rounded-xl bg-sand-100 px-4 py-2.5 text-sm font-semibold text-forest-400">
                      Full
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="pt-2 text-center text-[11px] text-forest-400">
        <Clock size={11} className="mr-1 inline" />
        Origin departure differs from your hub pickup time. Times in Africa/Kampala.
      </p>
    </div>
  );
}

function TimeCol({
  label,
  time,
  sub,
  highlight,
}: {
  label: string;
  time: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl py-1 ${highlight ? 'bg-lime-50' : ''}`}>
      <div className={`text-base font-bold ${highlight ? 'text-forest-800' : 'text-forest-700'}`}>
        {time}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-forest-400">{label}</div>
      {sub && <div className="truncate text-[10px] text-forest-500">{sub}</div>}
    </div>
  );
}
