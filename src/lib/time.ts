// Africa/Kampala is UTC+3 year-round (no DST).
export const KAMPALA_TZ = 'Africa/Kampala';
export const KAMPALA_OFFSET_MIN = 180;

/** Current date in Kampala as YYYY-MM-DD. */
export function kampalaToday(now: Date = new Date()): string {
  return kampalaDateISO(now);
}

/** Format a Date as YYYY-MM-DD in Kampala local time. */
export function kampalaDateISO(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KAMPALA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return parts; // en-CA yields YYYY-MM-DD
}

/**
 * Build an ISO timestamp for a given Kampala calendar date and wall-clock time.
 * Because Kampala is a fixed +03:00 offset, we can construct it directly.
 */
export function kampalaDateTime(dateISO: string, hours: number, minutes: number): string {
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${dateISO}T${hh}:${mm}:00+03:00`;
}

/** Add days to a YYYY-MM-DD string, returning YYYY-MM-DD. */
export function addDays(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Format an ISO instant as a Kampala clock time, e.g. "07:30". */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: KAMPALA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** Format an ISO instant as a friendly Kampala time, e.g. "7:30 AM". */
export function formatTime12(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: KAMPALA_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

/** Format a YYYY-MM-DD as e.g. "Thu, 11 Sep". */
export function formatDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(dt);
}

/** Relative "x min ago" style label. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs === 1) return '1 hr ago';
  if (hrs < 24) return `${hrs} hrs ago`;
  return formatDate(iso.slice(0, 10));
}

/** Apply a delay (minutes) to an ISO instant. */
export function shiftMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

/** Format UGX fares, e.g. 25000 -> "UGX 25,000". */
export function formatUGX(amount: number): string {
  return `UGX ${amount.toLocaleString('en-US')}`;
}

/** Minutes between two ISO instants (b - a). */
export function minutesBetween(aIso: string, bIso: string): number {
  return Math.round((new Date(bIso).getTime() - new Date(aIso).getTime()) / 60000);
}
