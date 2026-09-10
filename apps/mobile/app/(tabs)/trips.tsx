import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { H1, Muted, Loading, ErrorRow, SectionHeading, EmptyState } from '../../src/components/ui';
import { BookingStatusPill } from '../../src/components/StatusPill';
import { useAdapter, useDataEpoch } from '../../src/data/AdapterProvider';
import { useAsync } from '../../src/hooks/useAsync';
import { colors, radius, space, font, shadow } from '../../src/theme';
import { formatDate, formatTime, formatUGX } from '@shared/lib/time';
import type { BookingView } from '@shared/data/adapter';

export default function MyTrips() {
  const adapter = useAdapter();
  const router = useRouter();
  const epoch = useDataEpoch();
  const bookings = useAsync(() => adapter.myBookings(), [epoch]);

  // Refetch when the tab regains focus (e.g. after booking/cancelling).
  useFocusEffect(useCallback(() => { bookings.reload(); }, []));
  // Live refresh in connected mode.
  useEffect(() => {
    const sub = adapter.subscribeMyBookings(() => bookings.reload());
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const all = bookings.data ?? [];
  const upcoming = all.filter((b) => ['reserved', 'checked_in', 'boarded'].includes(b.status));
  const completed = all.filter((b) => b.status === 'completed');
  const notBoarded = all.filter((b) => b.status === 'missed_pickup' || b.status === 'not_boarded' || b.status === 'no_show');
  const cancelled = all.filter((b) => b.status === 'cancelled');

  return (
    <Screen>
      <H1>My Trips</H1>
      {bookings.loading && <Loading />}
      {bookings.error && <ErrorRow message={bookings.error} onRetry={bookings.reload} />}
      {!bookings.loading && all.length === 0 && (
        <EmptyState title="No trips yet">Reserve a seat from Home and it appears here with your boarding pass.</EmptyState>
      )}
      <Group title="Upcoming" list={upcoming} onOpen={(id) => router.push(`/trip/${id}`)} />
      <Group title="Completed" list={completed} onOpen={(id) => router.push(`/trip/${id}`)} muted />
      <Group title="Not boarded" list={notBoarded} onOpen={(id) => router.push(`/trip/${id}`)} muted />
      <Group title="Cancelled" list={cancelled} onOpen={(id) => router.push(`/trip/${id}`)} muted />
    </Screen>
  );
}

function Group({ title, list, onOpen, muted }: { title: string; list: BookingView[]; onOpen: (id: string) => void; muted?: boolean }) {
  if (list.length === 0) return null;
  return (
    <View>
      <SectionHeading title={`${title} (${list.length})`} />
      <View style={{ gap: 10 }}>
        {list.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => onOpen(b.id)}
            accessibilityRole="button"
            accessibilityLabel={`Booking ${b.reference}, pickup ${formatTime(b.pickupTimeSnapshot)}, ${b.status}`}
            style={({ pressed }) => [styles.row, muted && { opacity: 0.85 }, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.timeBlock}>
              <Text style={styles.time}>{formatTime(b.pickupTimeSnapshot)}</Text>
              <Text style={styles.timeMeta}>pickup</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ref}>{b.reference}</Text>
              <Muted style={{ fontSize: font.small }}>
                {b.seats} seat{b.seats === 1 ? '' : 's'} · {formatUGX(b.fareUgxSnapshot * b.seats)} · {formatDate(b.pickupTimeSnapshot.slice(0, 10))}
              </Muted>
              <View style={{ marginTop: 6, alignSelf: 'flex-start' }}><BookingStatusPill status={b.status} /></View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: radius.lg, padding: space.md, ...shadow.card },
  timeBlock: { width: 58, alignItems: 'flex-start' },
  time: { fontSize: font.h2, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  timeMeta: { fontSize: font.tiny, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  ref: { fontWeight: '800', color: colors.forest900, fontSize: font.body },
});
