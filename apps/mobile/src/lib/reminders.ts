import type { BookingView, HubView } from '@shared/data/adapter';
import { formatTime } from '@shared/lib/time';
import { CHECKIN_OPENS_MINUTES } from '@shared/state/logic';

/** Minutes before pickup for the "head to your hub" reminder. */
export const LEAVE_REMINDER_MINUTES = 30;

export interface PlannedReminder {
  id: string;
  bookingId: string;
  at: Date;
  title: string;
  body: string;
}

/**
 * Which on-device reminders a passenger should have, given their bookings. Pure, so
 * it can be tested without native modules. Only future, still-active bookings get
 * reminders; a reminder whose time has already passed is skipped.
 */
export function planReminders(
  bookings: BookingView[],
  hubs: Pick<HubView, 'id' | 'name'>[],
  enabled: boolean,
  now: Date = new Date(),
): PlannedReminder[] {
  if (!enabled) return [];
  const hubName = new Map(hubs.map((h) => [h.id, h.name]));
  const out: PlannedReminder[] = [];
  for (const b of bookings) {
    if (b.status !== 'reserved' && b.status !== 'checked_in') continue;
    const pickup = new Date(b.pickupTimeSnapshot);
    if (Number.isNaN(pickup.getTime()) || pickup <= now) continue;
    const hub = hubName.get(b.pickupHubId) ?? 'your pickup hub';
    const time = formatTime(b.pickupTimeSnapshot);

    const opens = new Date(pickup.getTime() - CHECKIN_OPENS_MINUTES * 60_000);
    if (b.status === 'reserved' && opens > now) {
      out.push({
        id: `togo-${b.id}-checkin`,
        bookingId: b.id,
        at: opens,
        title: 'Check-in is open',
        body: `Check in for your ${time} pickup at ${hub}.`,
      });
    }
    const leave = new Date(pickup.getTime() - LEAVE_REMINDER_MINUTES * 60_000);
    if (leave > now) {
      out.push({
        id: `togo-${b.id}-leave`,
        bookingId: b.id,
        at: leave,
        title: `Time to head to ${hub}`,
        body: `Your bus picks up at ${time}. Have your boarding pass ready.`,
      });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}
