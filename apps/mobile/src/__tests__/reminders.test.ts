import { describe, it, expect } from 'vitest';
import type { BookingView } from '@shared/data/adapter';
import { planReminders } from '../lib/reminders';

const hubs = [{ id: 'h1', name: 'Nakawa Green Hub' }];
const pickup = '2026-09-10T10:00:00+03:00';

function booking(over: Partial<BookingView> = {}): BookingView {
  return {
    id: 'b1', tripId: 't1', reference: 'ABC', boardingCredential: 'x', seats: 1,
    status: 'reserved', paymentStatus: 'unpaid', fareUgxSnapshot: 30000,
    pickupHubId: 'h1', dropoffHubId: 'h2', pickupTimeSnapshot: pickup,
    dropoffTimeSnapshot: '2026-09-10T14:00:00+03:00', passengerName: 'A',
    unresolved: false, createdAt: '2026-09-09T10:00:00+03:00', ...over,
  };
}

describe('planReminders', () => {
  const early = new Date('2026-09-10T06:00:00+03:00');

  it('plans check-in and leave reminders for a future reservation', () => {
    const plan = planReminders([booking()], hubs, true, early);
    expect(plan.map((r) => r.id)).toEqual(['togo-b1-checkin', 'togo-b1-leave']);
    expect(plan[0].at.toISOString()).toBe(new Date('2026-09-10T08:00:00+03:00').toISOString());
    expect(plan[1].at.toISOString()).toBe(new Date('2026-09-10T09:30:00+03:00').toISOString());
    expect(plan[1].title).toContain('Nakawa Green Hub');
  });

  it('skips the check-in reminder once checked in, and past reminders', () => {
    expect(planReminders([booking({ status: 'checked_in' })], hubs, true, early).map((r) => r.id)).toEqual(['togo-b1-leave']);
    const late = new Date('2026-09-10T09:45:00+03:00');
    expect(planReminders([booking()], hubs, true, late)).toEqual([]);
  });

  it('plans nothing for cancelled or finished trips, or when turned off', () => {
    for (const status of ['cancelled', 'boarded', 'completed', 'missed_pickup'] as const) {
      expect(planReminders([booking({ status })], hubs, true, early)).toEqual([]);
    }
    expect(planReminders([booking()], hubs, false, early)).toEqual([]);
  });
});
