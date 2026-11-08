import { describe, it, expect } from 'vitest';
import { buildMessages, chunk, deadTokens, shouldPush, ANDROID_CHANNEL, type NotificationRecord } from './messages';

const rec: NotificationRecord = {
  id: 'n1', user_id: 'u1', kind: 'delay', title: 'Your bus is running late',
  body: 'About 20 min late at Nakawa Green Hub.', trip_id: 't1', booking_id: 'b1',
};

describe('push messages', () => {
  it('pushes service alerts only', () => {
    for (const kind of ['trip_started', 'delay', 'trip_cancelled', 'schedule_changed', 'incident']) expect(shouldPush({ kind })).toBe(true);
    for (const kind of ['booking_confirmed', 'checked_in', 'boarded']) expect(shouldPush({ kind })).toBe(false);
    expect(shouldPush(null)).toBe(false);
  });

  it('builds one message per phone, opening the boarding pass when tapped', () => {
    const m = buildMessages(rec, ['ExponentPushToken[a]', 'ExponentPushToken[b]', 'ExponentPushToken[a]']);
    expect(m.map((x) => x.to)).toEqual(['ExponentPushToken[a]', 'ExponentPushToken[b]']);
    expect(m[0]).toMatchObject({ title: rec.title, body: rec.body, channelId: ANDROID_CHANNEL, data: { bookingId: 'b1', tripId: 't1', notificationId: 'n1' } });
  });

  it('leaves out missing ids and trims long text', () => {
    const [m] = buildMessages({ ...rec, booking_id: null, trip_id: null, title: '  ', body: 'x'.repeat(500) }, ['t']);
    expect(m.data).toEqual({ notificationId: 'n1' });
    expect(m.title).toBe('ToGo');
    expect(m.body).toHaveLength(300);
  });

  it('chunks requests and spots phones that no longer accept pushes', () => {
    expect(chunk(Array.from({ length: 250 }, (_, i) => i)).map((c) => c.length)).toEqual([100, 100, 50]);
    const sent = buildMessages(rec, ['A', 'B', 'C']);
    expect(deadTokens(sent, [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }, { status: 'error', details: { error: 'MessageRateExceeded' } }])).toEqual(['B']);
  });
});
