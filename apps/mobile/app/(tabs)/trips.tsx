import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { H1, Muted, Loading, ErrorRow, SectionHeading, EmptyState, Separator, PrimaryButton } from '../../src/components/ui';
import { BookingStatusPill } from '../../src/components/StatusPill';
import { useAdapter, useAppMode, useDataEpoch } from '../../src/data/AdapterProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { useAsync } from '../../src/hooks/useAsync';
import { colors, radius, space, font } from '../../src/theme';
import { formatDate, formatTime, formatUGX } from '@shared/lib/time';
import type { BookingView } from '@shared/data/adapter';

export default function MyTrips() {
  const adapter = useAdapter();
  const router = useRouter();
  const mode = useAppMode();
  const { session } = useAuth();
  const epoch = useDataEpoch();
  const signedOut = mode === 'connected' && !session;
  const bookings = useAsync(() => (signedOut ? Promise.resolve([]) : adapter.myBookings()), [epoch, signedOut]);

  // Refetch when the tab regains focus (e.g. after booking/cancelling).
  useFocusEffect(useCallback(() => { if (!signedOut) bookings.reload(); }, [signedOut]));
  // Live refresh in connected mode (only while signed in).
  useEffect(() => {
    if (signedOut) return;
    const sub = adapter.subscribeMyBookings(() => bookings.reload());
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedOut]);

  const all = bookings.data ?? [];
  const upcoming = all.filter((b) => ['reserved', 'checked_in', 'boarded'].includes(b.status));
  const completed = all.filter((b) => b.status === 'completed');
  const notBoarded = all.filter((b) => b.status === 'missed_pickup' || b.status === 'not_boarded' || b.status === 'no_show');
  const cancelled = all.filter((b) => b.status === 'cancelled');

  // Surface live service alerts (delays) on upcoming trips, like a real transit app.
  const upcomingTripIds = [...new Set(upcoming.map((b) => b.tripId))];
  const upcomingTrips = useAsync(
    () => Promise.all(upcomingTripIds.map((id) => adapter.getTrip(id))),
    [upcomingTripIds.join(','), epoch],
  );
  const delayByTrip = new Map<string, number>();
  for (const t of upcomingTrips.data ?? []) {
    if (t && t.delayMinutes > 0 && t.status !== 'completed' && t.status !== 'cancelled') {
      delayByTrip.set(t.id, t.delayMinutes);
    }
  }
  const delayedCount = new Set(upcoming.filter((b) => delayByTrip.has(b.tripId)).map((b) => b.tripId)).size;

  return (
    <Screen>
      <H1>My Trips</H1>
      {signedOut ? (
        <View style={{ gap: space.md, marginTop: space.sm }}>
          <EmptyState title="Sign in to see your trips">Your reservations and boarding passes appear here once you sign in.</EmptyState>
          <PrimaryButton title="Sign in" onPress={() => router.push('/auth?next=/trips')} />
        </View>
      ) : (
        <>
          {bookings.loading && <Loading />}
          {bookings.error && <ErrorRow message={bookings.error} onRetry={bookings.reload} />}
          {!bookings.loading && all.length === 0 && (
            <EmptyState title="You have no upcoming trips">Reserve a seat from Home and it appears here with your boarding pass.</EmptyState>
          )}
        </>
      )}
      <Group title="Upcoming" list={upcoming} onOpen={(id) => router.push(`/trip/${id}`)} delays={delayByTrip} />
      <Group title="Completed" list={completed} onOpen={(id) => router.push(`/trip/${id}`)} muted />
      <Group title="Not boarded" list={notBoarded} onOpen={(id) => router.push(`/trip/${id}`)} muted />
      <Group title="Cancelled" list={cancelled} onOpen={(id) => router.push(`/trip/${id}`)} muted />
    </Screen>
  );
}

function Group({ title, list, onOpen, muted, delays }: { title: string; list: BookingView[]; onOpen: (id: string) => void; muted?: boolean; delays?: Map<string, number> }) {
  if (list.length === 0) return null;
  return (
    <View>
      <SectionHeading title={`${title} · ${list.length}`} />
      <View style={styles.list}>
        {list.map((b, i) => {
          const delay = delays?.get(b.tripId) ?? 0;
          return (
          <View key={b.id}>
            {i > 0 && <Separator inset={70} />}
            <Pressable
              onPress={() => onOpen(b.id)}
              accessibilityRole="button"
              accessibilityLabel={`Booking ${b.reference}, pickup ${formatTime(b.pickupTimeSnapshot)}, ${b.status}${delay > 0 ? `, delayed ${delay} minutes` : ''}`}
              style={({ pressed }) => [styles.row, muted && { opacity: 0.9 }, pressed && { backgroundColor: colors.forest50 }]}
            >
              <View style={styles.timeBlock}>
                <Text style={styles.time}>{formatTime(b.pickupTimeSnapshot)}</Text>
                <Text style={styles.timeMeta}>{formatDate(b.pickupTimeSnapshot.slice(0, 10))}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ref}>{b.reference}</Text>
                <Muted style={{ fontSize: font.small }}>
                  {b.seats} seat{b.seats === 1 ? '' : 's'} · {formatUGX(b.fareUgxSnapshot * b.seats)}
                </Muted>
                <View style={styles.pillRow}>
                  <BookingStatusPill status={b.status} />
                  {delay > 0 && (
                    <View style={styles.delayChip}>
                      <Ionicons name="time-outline" size={11} color={colors.amber800} />
                      <Text style={styles.delayChipText}>Delayed +{delay}m</Text>
                    </View>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: space.md },
  timeBlock: { width: 58, alignItems: 'flex-start' },
  time: { fontSize: font.h2, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  timeMeta: { fontSize: font.tiny, color: colors.muted, marginTop: 1 },
  ref: { fontWeight: '600', color: colors.ink, fontSize: font.body },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  delayChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.amber100, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  delayChipText: { color: colors.amber800, fontSize: font.tiny, fontWeight: '600' },
});
