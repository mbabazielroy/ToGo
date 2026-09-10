import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, font } from '../theme';
import { formatTime, formatUGX } from '@shared/lib/time';
import type { TripView, TripStopView } from '@shared/data/adapter';

const DIR: Record<string, string> = { KLA_MBR: 'Kampala → Mbarara', MBR_KLA: 'Mbarara → Kampala' };

/**
 * Compact, glanceable departure row: a bold ABSOLUTE pickup time on the left, then
 * destination/operator/hub, with fare + seats. Origin departure is shown as a small
 * secondary line, kept distinct from the hub pickup time. A status label appears
 * only when the data supports it (delay / cancelled).
 */
export function DepartureRow({
  trip, pickup, onPress, seatsNeeded = 1,
}: {
  trip: TripView;
  pickup: TripStopView | undefined;
  onPress: () => void;
  seatsNeeded?: number;
}) {
  const dest = DIR[trip.direction] ?? '';
  const enough = trip.seatsAvailable >= seatsNeeded;
  const delayed = trip.delayMinutes > 0 && trip.status !== 'cancelled' && trip.status !== 'completed';
  const pickupTime = pickup ? formatTime(pickup.pickupTime) : formatTime(trip.originDeparture);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${dest}, pickup ${pickupTime} at ${pickup?.hubName ?? 'hub'}, ${trip.operatorName}, ${formatUGX(trip.fareUgx)}, ${trip.seatsAvailable} seats left`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.forest50 }]}
    >
      {/* Bold time block */}
      <View style={styles.timeBlock}>
        <Text style={styles.time} allowFontScaling>{pickupTime}</Text>
        <Text style={styles.timeMeta}>pickup</Text>
      </View>

      {/* Middle: destination + meta */}
      <View style={styles.mid}>
        <Text style={styles.dest} numberOfLines={1}>{dest}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {pickup?.hubName ?? 'Hub'} · {trip.operatorName}
        </Text>
        <View style={styles.badges}>
          {delayed ? (
            <Text style={[styles.badge, styles.badgeAmber]}>Delayed +{trip.delayMinutes}m · scheduled</Text>
          ) : trip.status === 'cancelled' ? (
            <Text style={[styles.badge, styles.badgeRed]}>Cancelled</Text>
          ) : (
            <Text style={[styles.badge, styles.badgeNeutral]}>Departs {formatTime(trip.originDeparture)} · scheduled</Text>
          )}
        </View>
      </View>

      {/* Right: fare + seats */}
      <View style={styles.right}>
        <Text style={styles.fare}>{formatUGX(trip.fareUgx)}</Text>
        <Text style={[styles.seats, !enough && { color: colors.red700, fontWeight: '800' }]}>
          {enough ? `${trip.seatsAvailable} seats` : trip.seatsAvailable === 0 ? 'Full' : `${trip.seatsAvailable} left`}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, minHeight: 64 },
  timeBlock: { width: 64, alignItems: 'flex-start' },
  time: { fontSize: font.time, fontWeight: '800', color: colors.ink, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  timeMeta: { fontSize: font.tiny, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: -2 },
  mid: { flex: 1, minWidth: 0 },
  dest: { fontSize: font.title, fontWeight: '800', color: colors.ink },
  sub: { fontSize: font.small, color: colors.inkSoft, marginTop: 1 },
  badges: { flexDirection: 'row', marginTop: 4 },
  badge: { fontSize: font.tiny, fontWeight: '700', borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  badgeNeutral: { backgroundColor: colors.surfaceAlt, color: colors.inkSoft },
  badgeAmber: { backgroundColor: colors.amber100, color: colors.amber800 },
  badgeRed: { backgroundColor: colors.red100, color: colors.red700 },
  right: { alignItems: 'flex-end', gap: 1 },
  fare: { fontSize: font.body, fontWeight: '800', color: colors.ink },
  seats: { fontSize: font.tiny, color: colors.muted, fontWeight: '600' },
});
