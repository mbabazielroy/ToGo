// What the push function sends, kept free of Deno and Supabase imports so it can be
// unit-tested in Node (messages.test.ts).

/** A row of public.notifications, as a database webhook delivers it. */
export interface NotificationRecord {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  trip_id: string | null;
  booking_id: string | null;
}

/** Expo push message (https://docs.expo.dev/push-notifications/sending-notifications/). */
export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'high';
  channelId: string;
  data: { bookingId?: string; tripId?: string; notificationId: string };
}

/**
 * Only service alerts the passenger didn't cause are pushed: their bus setting
 * off, delays, cancellations, schedule changes and incidents. Confirmations of
 * their own actions (reserved, checked in, boarded) stay in the app.
 */
export const PUSH_KINDS = new Set(['trip_started', 'delay', 'trip_cancelled', 'schedule_changed', 'incident']);

export function shouldPush(record: Pick<NotificationRecord, 'kind'> | null | undefined): boolean {
  return !!record && PUSH_KINDS.has(record.kind);
}

/** The Android channel the app creates for these alerts (PushRegistration.tsx). */
export const ANDROID_CHANNEL = 'service-alerts';

export function buildMessages(record: NotificationRecord, tokens: string[]): ExpoMessage[] {
  const title = record.title.trim().slice(0, 120) || 'ToGo';
  const body = record.body.trim().slice(0, 300);
  const data: ExpoMessage['data'] = { notificationId: record.id };
  if (record.booking_id) data.bookingId = record.booking_id;
  if (record.trip_id) data.tripId = record.trip_id;
  return [...new Set(tokens)].map((to) => ({
    to, title, body, sound: 'default', priority: 'high', channelId: ANDROID_CHANNEL, data,
  }));
}

/** Expo accepts at most 100 messages per request. */
export function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Push tickets that say the phone no longer accepts pushes (app removed, etc.). */
export function deadTokens(sent: ExpoMessage[], tickets: { status: string; details?: { error?: string } }[]): string[] {
  return tickets.flatMap((t, i) =>
    t.status === 'error' && t.details?.error === 'DeviceNotRegistered' && sent[i] ? [sent[i].to] : []);
}
