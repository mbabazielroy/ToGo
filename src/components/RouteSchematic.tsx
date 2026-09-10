import { Bus, MapPin, Flag } from 'lucide-react';
import type { AppState, Trip } from '../types';
import { hubById, DIRECTION_LABEL } from '../lib/lookup';
import { formatTime } from '../lib/time';
import { effectivePickupTime } from '../state/logic';

interface Props {
  state: AppState;
  trip: Trip;
}

/** A schematic (not geographic) route diagram with a moving bus marker. */
export function RouteSchematic({ state, trip }: Props) {
  const origin = trip.direction === 'KLA_MBR' ? 'Kampala' : 'Mbarara';
  const destination = trip.direction === 'KLA_MBR' ? 'Mbarara' : 'Kampala';
  const pct = Math.round(trip.progress * 100);

  return (
    <div className="rounded-2xl bg-forest-700 p-4 text-white">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{DIRECTION_LABEL[trip.direction]}</span>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium">
          Simulated tracking
        </span>
      </div>

      {/* Track */}
      <div className="relative mt-6 mb-8 h-1.5 rounded-full bg-white/20">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-lime-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
        {/* Origin marker */}
        <Node left={0} label={origin} icon={<MapPin size={12} />} active />
        {/* Hub markers cluster near origin */}
        {trip.stops.map((s, i) => {
          const hub = hubById(state, s.hubId);
          const left = trip.stops.length > 1 ? 8 + (i / (trip.stops.length * 2)) * 100 : 12;
          return (
            <Node
              key={s.hubId}
              left={Math.min(left, 40)}
              label={hub?.name.split(' ')[0] ?? 'Hub'}
              icon={<MapPin size={12} />}
              active={s.reached}
              small
            />
          );
        })}
        {/* Destination marker */}
        <Node left={100} label={destination} icon={<Flag size={12} />} active={trip.progress >= 1} alignRight />
        {/* Moving bus */}
        <div
          className="absolute -top-4 z-10 -translate-x-1/2 transition-all duration-500"
          style={{ left: `${pct}%` }}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-forest-800 shadow-raised ring-2 ring-lime-400">
            <Bus size={16} />
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Progress" value={`${pct}%`} />
        <Stat
          label="Your pickup"
          value={
            (() => {
              const t = effectivePickupTime(trip, trip.stops[0].hubId);
              return t ? formatTime(t) : '—';
            })()
          }
        />
        <Stat label="Delay" value={trip.delayMinutes > 0 ? `+${trip.delayMinutes}m` : 'None'} />
      </div>
      <p className="mt-3 text-center text-[11px] text-forest-100/70">
        Last simulated update {formatTime(trip.lastUpdate)} · schematic only, not geographic navigation.
      </p>
    </div>
  );
}

function Node({
  left,
  label,
  icon,
  active,
  small,
  alignRight,
}: {
  left: number;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  small?: boolean;
  alignRight?: boolean;
}) {
  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
      style={{ left: `${left}%` }}
    >
      <span
        className={`flex items-center justify-center rounded-full ${
          small ? 'h-3.5 w-3.5' : 'h-5 w-5'
        } ${active ? 'bg-lime-400 text-forest-900' : 'bg-white/40 text-forest-900'}`}
      >
        {!small && icon}
      </span>
      <span
        className={`absolute top-6 whitespace-nowrap text-[10px] font-medium text-forest-100/80 ${
          alignRight ? 'right-0' : small ? 'left-1/2 -translate-x-1/2' : 'left-1/2 -translate-x-1/2'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 py-2">
      <div className="text-sm font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-forest-100/70">{label}</div>
    </div>
  );
}
