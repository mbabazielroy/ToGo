import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, space, font } from '../theme';
import { formatTime, formatUGX } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import type { TripView, TripStopView } from '@shared/data/adapter';

/**
 * Carefully typeset departure row:
 *   pickup time (prominent, left)              fare (right)
 *   operator / destination (readable)
 *   pickup hub · service status · seats (secondary)
 * The corridor is established by the screen, so the destination is repeated only
 * when `showDestination` is set (e.g. a mixed list on a hub page).
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

  const primary = showDestination ? `To ${destinationCity}` : trip.operatorName;
  // Exceptions only on the secondary line, so the common case stays short.
  const exception = cancelled ? 'Cancelled' : delayed ? `Delayed +${trip.delayMinutes}m` : (soldOut || tight) ? seatsText : null;
  const exTone = cancelled ? colors.red700 : delayed ? colors.amber800 : soldOut ? colors.red700 : colors.amber800;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${primary}, pickup ${pickupTime} at ${pickup?.hubName ?? 'hub'}, ${formatUGX(trip.fareUgx)}, ${cancelled ? 'cancelled' : delayed ? `delayed ${trip.delayMinutes} minutes` : 'scheduled'}, ${seatsText}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.forest50 }]}
    >
      <Text style={styles.time} numberOfLines={1} allowFontScaling>{pickupTime}</Text>
      <View style={styles.mid}>
        <Text style={styles.primary} numberOfLines={1}>{primary}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {pickup?.hubName ?? 'Pickup hub'}{exception ? <Text style={{ color: exTone }}>{`  ·  ${exception}`}</Text> : null}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.fare} numberOfLines={1} allowFontScaling>{formatUGX(trip.fareUgx)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, minHeight: 60 },
  time: { width: 66, fontSize: 22, fontWeight: '600', color: colors.ink, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  mid: { flex: 1, minWidth: 0 },
  primary: { fontSize: font.body, fontWeight: '600', color: colors.ink },
  meta: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  fare: { fontSize: font.small, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
});
