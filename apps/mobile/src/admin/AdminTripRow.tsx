import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineBadge } from '@/components/ui';
import { TripStatusPill } from '@/components/StatusPill';
import { lineFor } from '@/lib/lines';
import { space, font, SCREEN, useColors, makeStyles } from '@/theme';
import { formatTime } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import type { TripView } from '@shared/data/adapter';

/** Whether a departure still needs crew (only matters while it can still run). */
export function crewGaps(t: TripView): string[] {
  if (t.status === 'completed' || t.status === 'cancelled') return [];
  const gaps: string[] = [];
  if (!t.driverName) gaps.push('driver');
  if (!t.conductorName) gaps.push('conductor');
  return gaps;
}

/** Operations row: time, line, route, load bar, crew, status. */
export function AdminTripRow({ trip, onPress }: { trip: TripView; onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const line = lineFor(trip.operatorId, trip.operatorName);
  const cities = DIRECTION_CITIES[trip.direction];
  const load = trip.capacity > 0 ? trip.seatsReserved / trip.capacity : 0;
  const gaps = crewGaps(trip);
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`${formatTime(trip.originDeparture)} ${trip.operatorName} ${cities.origin} to ${cities.destination}, ${trip.seatsReserved} of ${trip.capacity} booked${gaps.length ? `, needs ${gaps.join(' and ')}` : ''}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.forest50 }]}>
      <View style={{ width: 54 }}>
        <Text style={[styles.time, trip.status === 'cancelled' && styles.struck]}>{formatTime(trip.originDeparture)}</Text>
        <LineBadge code={line.code} color={line.color} size="sm" />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.route} numberOfLines={1}>{cities.origin} → {cities.destination}</Text>
        <View style={styles.loadRow}>
          <View style={styles.bar}><View style={[styles.fill, { width: `${Math.min(100, Math.round(load * 100))}%`, backgroundColor: load >= 0.9 ? colors.amber600 : line.color }]} /></View>
          <Text style={styles.loadText}>{trip.seatsReserved}/{trip.capacity}</Text>
        </View>
        <View style={styles.tags}>
          <TripStatusPill status={trip.status} delayed={trip.delayMinutes > 0} />
          {gaps.length > 0 && (
            <View style={styles.gap}><Ionicons name="person-add-outline" size={11} color={colors.red700} /><Text style={styles.gapText}>Needs {gaps.join(' + ')}</Text></View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: SCREEN, paddingVertical: space.md },
  time: { fontSize: font.title, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'], marginBottom: 4 },
  struck: { textDecorationLine: 'line-through', color: colors.muted },
  route: { fontSize: font.body, fontWeight: '700', color: colors.ink },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  loadText: { fontSize: font.tiny, color: colors.muted, fontVariant: ['tabular-nums'], fontWeight: '600', minWidth: 38, textAlign: 'right' },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  gap: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.red100, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  gapText: { fontSize: font.tiny, color: colors.red700, fontWeight: '700' },
}));
