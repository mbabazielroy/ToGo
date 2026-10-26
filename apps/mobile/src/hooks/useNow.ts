import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Current time, re-rendered every `intervalMs` and when the app returns to the
 *  foreground — drives live countdowns ("Leaves in 12 min"). */
export function useNow(intervalMs = 30000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setNow(new Date()); });
    return () => { clearInterval(id); sub.remove(); };
  }, [intervalMs]);
  return now;
}

export interface Countdown {
  /** Large value, e.g. "12", "2h 05", "Now". */
  value: string;
  /** Unit/caption under or beside it, e.g. "min", "", "Departed". */
  unit: string;
  /** Minutes from now (negative once passed). */
  minutes: number;
}

/** Transit-style countdown to an instant. Within 90 min shows minutes; beyond
 *  shows hours+minutes; past shows how long ago. */
export function countdown(iso: string, now: Date): Countdown {
  const minutes = Math.round((new Date(iso).getTime() - now.getTime()) / 60000);
  if (minutes <= 0 && minutes > -2) return { value: 'Now', unit: '', minutes };
  if (minutes < 0) {
    const ago = -minutes;
    return ago < 60
      ? { value: `${ago}`, unit: 'min ago', minutes }
      : { value: `${Math.floor(ago / 60)}h`, unit: 'ago', minutes };
  }
  if (minutes < 90) return { value: `${minutes}`, unit: 'min', minutes };
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) return { value: `${Math.floor(h / 24)}d`, unit: `${h % 24}h`, minutes };
  return { value: `${h}h ${String(m).padStart(2, '0')}`, unit: '', minutes };
}

/** Plain-language lead time: "in 12 min", "in 2 h 5 min", "now", "12 min ago". */
export function leadTime(iso: string, now: Date): string {
  const minutes = Math.round((new Date(iso).getTime() - now.getTime()) / 60000);
  if (Math.abs(minutes) < 2) return 'now';
  if (minutes < 0) return -minutes < 60 ? `${-minutes} min ago` : `${Math.floor(-minutes / 60)} h ago`;
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) return `in ${Math.floor(h / 24)} day${h >= 48 ? 's' : ''}`;
  return m ? `in ${h} h ${m} min` : `in ${h} h`;
}

/** Greeting for the passenger home header. */
export function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kampala', hour: 'numeric', hour12: false }).format(now));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
