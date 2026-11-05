import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { PageHeader, Muted, Loading, ErrorRow, SectionHeading, EmptyState, Separator, PrimaryButton } from '@/components/ui';
import { BookingStatusPill } from '@/components/StatusPill';
import { useAdapter, useAppMode, useDataEpoch } from '@/data/AdapterProvider';
import { useAuth } from '@/auth/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { colors, radius, space, font } from '@/theme';
import { formatDate, formatTime, formatUGX } from '@shared/lib/time';
import type { BookingView } from '@shared/data/adapter';
import { DIRECTION_CITIES } from '@shared/lib/lookup';

export default function MyTrips() {
  const adapter = useAdapter();
  const router = useRouter();
  const mode = useAppMode();
  const { session } = useAuth();
  const epoch = useDataEpoch();
  const signedOut = mode === 'connected' && !session;
  const bookings = useAsync(() => (signedOut ? Promise.resolve([]) : adapter.myBookings()), [epoch, signedOut]);

  // Refetch when the tab regains focus (e.g. after booking/cancelling).
  const reloadBookings = bookings.reload;
  useFocusEffect(useCallback(() => { if (!signedOut) reloadBookings(); }, [signedOut, reloadBookings]));
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
  const tripIds = [...new Set(all.map((b) => b.tripId))];
  const trips = useAsync(
    () => Promise.all(tripIds.map((id) => adapter.getTrip(id))),
    [tripIds.join(','), epoch],
  );
  const destByTrip = new Map<string, string>();
  const delayByTrip = new Map<string, number>();
  for (const t of trips.data ?? []) {
    if (t) destByTrip.set(t.id, DIRECTION_CITIES[t.direction].destination);
  }
  for (const t of trips.data ?? []) {
    if (t && t.delayMinutes > 0 && t.status !== 'completed' && t.status !== 'cancelled') {
      delayByTrip.set(t.id, t.delayMinutes);
    }
  }

  return (
    <Screen showHeader={false}>
      <PageHeader title="My trips" subtitle={upcoming.length ? `${upcoming.length} upcoming` : undefined} />
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
            <View style={{ gap: space.md }}>
              <EmptyState title="No trips yet">Reserve a seat and your boarding pass will live here.</EmptyState>
              <PrimaryButton title="Find a departure" icon="search" onPress={() => router.push('/home')} />
            </View>
          )}
        </>
      )}
      <Group title="Upcoming" list={upcoming} onOpen={(id) => router.push(`/trip/${id}`)} delays={delayByTrip} dest={destByTrip} />
      <Group title="Completed" list={completed} onOpen={(id) => router.push(`/trip/${id}`)} muted dest={destByTrip} />
      <Group title="Not boarded" list={notBoarded} onOpen={(id) => router.push(`/trip/${id}`)} muted dest={destByTrip} />
      <Group title="Cancelled" list={cancelled} onOpen={(id) => router.push(`/trip/${id}`)} muted dest={destByTrip} />
    </Screen>
  );
}

function Group({ title, list, onOpen, muted, delays, dest }: { title: string; list: BookingView[]; onOpen: (id: string) => void; muted?: boolean; delays?: Map<string, number>; dest?: Map<string, string> }) {
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
                <Text style={styles.ref}>{dest?.get(b.tripId) ? `To ${dest.get(b.tripId)}` : b.reference}</Text>
                <Muted style={{ fontSize: font.small }}>
                  {dest?.get(b.tripId) ? `${b.reference} · ` : ''}{b.seats} seat{b.seats === 1 ? '' : 's'} · {formatUGX(b.fareUgxSnapshot * b.seats)}
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
