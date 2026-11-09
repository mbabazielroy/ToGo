import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineBadge } from './ui';
import { space, font, radius, useColors, makeStyles } from '../theme';
import { lineFor } from '../lib/lines';
import { countdown } from '../hooks/useNow';
import { formatTime, formatUGX } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import type { TripView, TripStopView } from '@shared/data/adapter';

/**
 * Transit-style departure card:
 *   [LINE] Operator                                 12
 *   Pickup hub → Destination                       min
 *   07:00 pickup · 14 seats · UGX 25,000
 * The big right-hand countdown is the thing people scan for; exceptions (delay,
 * cancelled, few seats, full) replace the calm secondary line in colour.
 */
export function DepartureRow({
  trip, pickup, onPress, seatsNeeded = 1, showDestination = true, now,
}: {
  trip: TripView;
  pickup: TripStopView | undefined;
  onPress: () => void;
  seatsNeeded?: number;
  showDestination?: boolean;
  now: Date;
}) {
  const colors = useColors();
  const styles = useStyles();
  const line = lineFor(trip.operatorId, trip.operatorName);
  const pickupISO = pickup?.pickupTime ?? trip.originDeparture;
  const destinationCity = DIRECTION_CITIES[trip.direction].destination;
  const cancelled = trip.status === 'cancelled';
  const finished = trip.status === 'completed';
  const live = trip.status === 'boarding' || trip.status === 'en_route';
  const delayed = trip.delayMinutes > 0 && !cancelled && !finished;
  const soldOut = trip.seatsAvailable === 0;
  const tight = !soldOut && trip.seatsAvailable < Math.max(seatsNeeded, 5);
  const cd = countdown(pickupISO, now);
  const gone = cd.minutes < -1 || finished;

  const status = cancelled
    ? { text: 'Cancelled', color: colors.red700 }
    : finished
      ? { text: 'Completed', color: colors.muted }
      : delayed
        ? { text: `Delayed ${trip.delayMinutes} min`, color: colors.amber800 }
        : soldOut
          ? { text: 'Full', color: colors.red700 }
          : tight
            ? { text: `${trip.seatsAvailable} seat${trip.seatsAvailable === 1 ? '' : 's'} left`, color: colors.amber800 }
            : { text: `${trip.seatsAvailable} seats`, color: colors.muted };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${trip.operatorName}, pickup ${formatTime(pickupISO)} at ${pickup?.hubName ?? 'hub'} to ${destinationCity}, ${cancelled ? 'cancelled' : `leaves ${cd.value} ${cd.unit}`}, ${status.text}, ${formatUGX(trip.fareUgx)}`}
      style={({ pressed }) => [styles.card, (cancelled || gone) && { opacity: 0.6 }, pressed && { backgroundColor: colors.forest50 }]}
    >
      <View style={[styles.stripe, { backgroundColor: line.color }]} />
      <View style={styles.body}>
        <View style={styles.top}>
          <LineBadge code={line.code} color={line.color} text={line.text} />
          <Text style={styles.operator} numberOfLines={1}>{trip.operatorName}</Text>
          {live && (
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{trip.status === 'boarding' ? 'Boarding' : 'Live'}</Text>
            </View>
          )}
        </View>
        <Text style={styles.route} numberOfLines={1}>{showDestination ? `To ${destinationCity}` : pickup?.hubName ?? 'Pickup hub'}</Text>
        {showDestination && <Text style={styles.from} numberOfLines={1}>from {pickup?.hubName ?? 'pickup hub'}</Text>}
        <Text style={styles.meta} numberOfLines={1}>
          {formatTime(pickupISO)} pickup  ·  <Text style={{ color: status.color, fontWeight: status.color === colors.muted ? '400' : '600' }}>{status.text}</Text>  ·  {formatUGX(trip.fareUgx)}
        </Text>
      </View>
      <View style={styles.when}>
        {cancelled ? (
          <Ionicons name="close-circle" size={26} color={colors.red700} />
        ) : (
          <>
            <Text style={[styles.big, live && { color: colors.forest600 }, cd.value.length > 4 && { fontSize: 20 }]} numberOfLines={1}>{cd.value}</Text>
            {cd.unit ? <Text style={styles.unit}>{cd.unit}</Text> : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', minHeight: 92 },
  stripe: { width: 5 },
  body: { flex: 1, minWidth: 0, paddingVertical: space.md, paddingLeft: space.md, paddingRight: space.sm, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  operator: { flexShrink: 1, fontSize: font.small, fontWeight: '600', color: colors.inkSoft },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.forest100, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live },
  liveText: { fontSize: 11, fontWeight: '800', color: colors.forest700, textTransform: 'uppercase', letterSpacing: 0.4 },
  route: { fontSize: font.body, fontWeight: '700', color: colors.ink },
  from: { fontSize: font.small, color: colors.inkSoft, marginTop: -2 },
  meta: { fontSize: font.tiny, color: colors.muted },
  when: { width: 78, alignItems: 'center', justifyContent: 'center', paddingRight: space.sm },
  big: { fontSize: 28, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'], letterSpacing: -0.8 },
  unit: { fontSize: font.tiny, color: colors.muted, fontWeight: '600', marginTop: -2 },
}));
