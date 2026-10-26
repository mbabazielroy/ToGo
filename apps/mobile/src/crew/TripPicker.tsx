import { ScrollView, Pressable, Text, StyleSheet, View } from 'react-native';
import { colors, font } from '@/theme';
import { formatTime } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import type { TripView } from '@shared/data/adapter';
import { haptics } from '@/lib/feedback';

/** Horizontal selector between a crew member's assigned departures (on the dark header). */
export function TripPicker({ trips, activeId, onSelect }: { trips: TripView[]; activeId?: string; onSelect: (id: string) => void }) {
  if (trips.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {trips.map((t) => {
        const on = t.id === activeId;
        const done = t.status === 'completed' || t.status === 'cancelled';
        return (
          <Pressable key={t.id} onPress={() => { haptics.select(); onSelect(t.id); }} accessibilityRole="button" accessibilityState={{ selected: on }}
            accessibilityLabel={`${formatTime(t.originDeparture)} ${DIRECTION_CITIES[t.direction].origin} to ${DIRECTION_CITIES[t.direction].destination}`}
            style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.time, on && styles.timeOn, done && { textDecorationLine: 'line-through' }]}>{formatTime(t.originDeparture)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[styles.dir, on && styles.dirOn]}>{t.direction === 'KLA_MBR' ? 'KLA → MBR' : 'MBR → KLA'}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.10)' },
  chipOn: { backgroundColor: colors.white },
  time: { color: colors.white, fontSize: font.body, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timeOn: { color: colors.forest900 },
  dir: { color: colors.onDarkSoft, fontSize: 11, fontWeight: '700' },
  dirOn: { color: colors.forest700 },
});
