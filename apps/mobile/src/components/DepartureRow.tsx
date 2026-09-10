import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { formatTime, formatUGX } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import type { TripView, TripStopView } from '@shared/data/adapter';

/**
 * Two-line departure row.
 *   Line 1: prominent pickup time (left) · fare (right)
 *   Line 2: destination/operator (wraps)
 *   Line 3: pickup hub · schedule/status · seats
 * The corridor is established by the screen, so it is not repeated on every row
 * unless `showDestination` is set (e.g. a mixed list).
 */
export function DepartureRow({
  trip, pickup, onPress, seatsNeeded = 1, showDestination = false,
}: {
  trip: TripView;
  pickup: TripStopView | undefined;
  onPress: () => void;
  seatsNeeded?: number;
  showDestination?: boolean;
}) {
  const pickupTime = pickup ? formatTime(pickup.pickupTime) : formatTime(trip.originDeparture);
  const destinationCity = DIRECTION_CITIES[trip.direction].destination;
  const cancelled = trip.status === 'cancelled';
  const delayed = trip.delayMinutes > 0 && !cancelled && trip.status !== 'completed';

  const soldOut = trip.seatsAvailable === 0;
  const tight = !soldOut && trip.seatsAvailable < seatsNeeded;
  const seatsText = soldOut ? 'Full' : tight ? `Only ${trip.seatsAvailable} left` : `${trip.seatsAvailable} seats`;
  const seatsTone = soldOut ? colors.red700 : tight ? colors.amber800 : colors.muted;

  const primary = showDestination ? `To ${destinationCity} · ${trip.operatorName}` : trip.operatorName;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${primary}, pickup ${pickupTime} at ${pickup?.hubName ?? 'hub'}, ${formatUGX(trip.fareUgx)}, ${seatsText}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.forest50 }]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.line1}>
          <Text style={styles.time} allowFontScaling>{pickupTime}</Text>
          <Text style={styles.fare} allowFontScaling>{formatUGX(trip.fareUgx)}</Text>
        </View>
        <Text style={styles.primary} numberOfLines={2}>{primary}</Text>
        <View style={styles.meta}>
          <Text style={styles.hub} numberOfLines={1}>{pickup?.hubName ?? 'Pickup hub'}</Text>
          {cancelled ? (
            <Text style={[styles.status, { color: colors.red700 }]}>· Cancelled</Text>
          ) : delayed ? (
            <Text style={[styles.status, { color: colors.amber800 }]}>· Delayed +{trip.delayMinutes}m</Text>
          ) : (
            <Text style={[styles.status, { color: colors.muted }]}>· Scheduled</Text>
          )}
          <Text style={[styles.seats, { color: seatsTone }]} numberOfLines={1}>· {seatsText}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} style={{ marginLeft: space.sm }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, paddingHorizontal: space.xs },
  line1: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  time: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  fare: { fontSize: font.body, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  primary: { fontSize: font.body, fontWeight: '600', color: colors.inkSoft, marginTop: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 3, gap: 4 },
  hub: { fontSize: font.small, color: colors.muted, flexShrink: 1 },
  status: { fontSize: font.small, fontWeight: '600' },
  seats: { fontSize: font.small },
});
