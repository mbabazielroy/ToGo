import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radius, font } from '../theme';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

/** Compact 2–3 option control; the selected option uses the lime accent. */
export function SegmentedControl<T extends string>({
  segments, value, onChange, label,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist" accessibilityLabel={label}>
      {segments.map((s) => {
        const selected = s.value === value;
        return (
          <Pressable
            key={s.value}
            onPress={() => onChange(s.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.seg, selected && styles.segSelected]}
          >
            <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 3, gap: 3 },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: radius.sm, minHeight: 44 },
  segSelected: { backgroundColor: colors.lime400 },
  text: { fontWeight: '700', fontSize: font.small, color: colors.inkSoft },
  textSelected: { color: colors.forest900 },
});
