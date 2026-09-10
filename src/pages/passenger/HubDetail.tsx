import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Umbrella,
  Armchair,
  Toilet,
  UserCheck,
  Droplet,
  Lightbulb,
  Clock,
  Navigation,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { useStore } from '../../state/store';
import { useSearch } from '../../state/search';
import { hubById, operatorById } from '../../lib/lookup';
import { formatTime, formatUGX, kampalaToday } from '../../lib/time';
import { availableSeats, effectivePickupTime } from '../../state/logic';
import { DemoNote } from '../../components/ui';
import { TripStatusPill } from '../../components/StatusPill';
import type { HubFacilities } from '../../types';

const FACILITY_META: { key: keyof HubFacilities; label: string; icon: typeof Umbrella }[] = [
  { key: 'shelter', label: 'Shelter', icon: Umbrella },
  { key: 'seating', label: 'Seating', icon: Armchair },
  { key: 'toilets', label: 'Toilets', icon: Toilet },
  { key: 'attendant', label: 'Attendant', icon: UserCheck },
  { key: 'water', label: 'Water', icon: Droplet },
  { key: 'lighting', label: 'Lighting', icon: Lightbulb },
];

export function HubDetail() {
  const { hubId = '' } = useParams();
  const { state } = useStore();
  const { setCriteria } = useSearch();
  const navigate = useNavigate();
  const hub = hubById(state, hubId);

  if (!hub) {
    return (
      <div className="space-y-3">
        <BackLink />
        <p className="text-forest-600">Hub not found.</p>
      </div>
    );
  }

  // Departures serving this hub (today onwards), soonest first.
  const departures = state.trips
    .filter((t) => t.stops.some((s) => s.hubId === hubId) && t.date >= kampalaToday())
    .filter((t) => t.status !== 'cancelled')
    .sort((a, b) => a.originDeparture.localeCompare(b.originDeparture))
    .slice(0, 6);

  function chooseHub() {
    const route = state.routes.find((r) => r.hubSequence.includes(hubId))!;
    setCriteria({ direction: route.direction, hubId, date: kampalaToday() });
    navigate('/search');
  }

  return (
    <div className="space-y-4">
      <BackLink />

      <div>
        <span className="inline-flex items-center gap-1 rounded-full bg-forest-100 px-2 py-0.5 text-xs font-semibold text-forest-700">
          <MapPin size={12} /> {hub.city}
        </span>
        <h1 className="mt-2 text-2xl font-extrabold text-forest-900">{hub.name}</h1>
        <p className="mt-1 text-sm text-forest-500">{hub.area}</p>
      </div>

      <DemoNote>
        Illustrative demo location. ToGo does not imply this site is officially approved or partnered.
      </DemoNote>

      {/* Facilities */}
      <div className="card p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-forest-600">Facilities</h2>
        <div className="grid grid-cols-3 gap-2">
          {FACILITY_META.map((f) => {
            const on = hub.facilities[f.key];
            return (
              <div
                key={f.key}
                className={`flex flex-col items-center gap-1 rounded-xl py-3 text-center ${
                  on ? 'bg-lime-50 text-forest-700' : 'bg-sand-50 text-forest-300'
                }`}
              >
                <f.icon size={20} />
                <span className="text-[11px] font-medium">{f.label}</span>
                {!on && <span className="text-[9px] uppercase">n/a</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hours + instructions */}
      <div className="card space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Clock size={18} className="mt-0.5 shrink-0 text-forest-500" />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-forest-500">Opening hours</div>
            <div className="text-sm text-forest-800">{hub.openingHours}</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Navigation size={18} className="mt-0.5 shrink-0 text-forest-500" />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-forest-500">Arrival instructions</div>
            <div className="text-sm text-forest-800">{hub.arrivalInstructions}</div>
          </div>
        </div>
      </div>

      {/* Departures */}
      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-forest-600">
          Departures serving this hub
        </h2>
        {departures.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-forest-500 shadow-card">
            No upcoming departures serve this hub right now.
          </p>
        ) : (
          <div className="space-y-2">
            {departures.map((t) => {
              const op = operatorById(state, t.operatorId);
              const pickup = effectivePickupTime(t, hubId);
              const seats = availableSeats(state, t);
              return (
                <Link
                  key={t.id}
                  to={`/book/${t.id}`}
                  onClick={() => setCriteria({ hubId })}
                  className="card flex items-center justify-between p-3.5 transition active:scale-[0.99] hover:shadow-raised"
                >
                  <div>
                    <div className="font-semibold text-forest-900">{op?.name}</div>
                    <div className="text-xs text-forest-500">
                      Pickup {pickup ? formatTime(pickup) : '—'} · {seats} seat{seats === 1 ? '' : 's'} left
                    </div>
                    <div className="mt-1">
                      <TripStatusPill status={t.status} delayed={t.delayMinutes > 0} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-forest-900">{formatUGX(t.farePerSeat)}</div>
                    <ChevronRight size={16} className="ml-auto text-forest-300" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={chooseHub} className="btn-primary w-full">
        Choose this hub
      </button>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/hubs" className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600">
      <ArrowLeft size={16} /> All hubs
    </Link>
  );
}
