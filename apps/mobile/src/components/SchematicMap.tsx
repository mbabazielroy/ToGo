import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, font, shadow } from '../theme';
import type { HubView } from '@shared/data/adapter';

/**
 * A SCHEMATIC hub map — deliberately NOT geographic. Hubs have no coordinates in
 * this pilot, so pins are laid out illustratively along a stylised corridor. It is
 * clearly labelled as a schematic and draws no streets and no live bus. When a real
 * map (dev build + provider key) is wired later, this component can be swapped.
 */
export function SchematicMap({
  hubs, selectedHubId, onSelectHub, originCity, destCity,
}: {
  hubs: HubView[];
  selectedHubId: string | null;
  onSelectHub: (id: string) => void;
  originCity: string;
  destCity: string;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  // Deterministic illustrative positions along a diagonal corridor.
  const pins = hubs.map((h, i) => {
    const t = hubs.length <= 1 ? 0.5 : i / (hubs.length - 1);
    const x = 0.14 + t * 0.72;
    const y = 0.72 - t * 0.44 + (i % 2 === 0 ? 0.06 : -0.06);
    return { hub: h, x: x * size.w, y: y * size.h };
  });

  return (
    <View style={styles.wrap} onLayout={onLayout} accessibilityLabel={`Schematic map of pickup hubs in ${originCity}`}>
      {size.w > 0 && (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          {/* Abstract corridor — NOT a road route */}
          <Path
            d={`M ${size.w * 0.1} ${size.h * 0.8} C ${size.w * 0.4} ${size.h * 0.55}, ${size.w * 0.55} ${size.h * 0.45}, ${size.w * 0.9} ${size.h * 0.2}`}
            stroke={colors.mapLine}
            strokeWidth={10}
            strokeLinecap="round"
            fill="none"
          />
          {/* faint parallel lanes for texture */}
          <Path d={`M ${size.w * 0.05} ${size.h * 0.45} L ${size.w * 0.95} ${size.h * 0.35}`} stroke={colors.mapLine} strokeWidth={2} opacity={0.5} fill="none" />
          <Path d={`M ${size.w * 0.05} ${size.h * 0.95} L ${size.w * 0.95} ${size.h * 0.85}`} stroke={colors.mapLine} strokeWidth={2} opacity={0.5} fill="none" />
          {pins.map((p) => (
            <Circle key={`c-${p.hub.id}`} cx={p.x} cy={p.y} r={p.hub.id === selectedHubId ? 15 : 9}
              fill={p.hub.id === selectedHubId ? colors.lime400 : colors.white}
              stroke={p.hub.id === selectedHubId ? colors.forest700 : colors.forest500} strokeWidth={3} />
          ))}
        </Svg>
      )}

      {/* Tappable pin hit-targets + labels overlaid on the SVG */}
      {pins.map((p) => {
        const selected = p.hub.id === selectedHubId;
        return (
          <Pressable
            key={p.hub.id}
            onPress={() => onSelectHub(p.hub.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${p.hub.name} pickup hub${selected ? ', selected' : ''}`}
            hitSlop={12}
            style={[styles.pinHit, { left: p.x - 22, top: p.y - 22 }]}
          >
            {selected && (
              <View style={styles.pinLabel}>
                <Text style={styles.pinLabelText} numberOfLines={1}>{p.hub.name}</Text>
              </View>
            )}
          </Pressable>
        );
      })}

      {/* City endpoints */}
      <View style={[styles.cityTag, { left: 10, bottom: 10 }]}>
        <Ionicons name="ellipse" size={9} color={colors.forest700} />
        <Text style={styles.cityText}>{originCity}</Text>
      </View>
      <View style={[styles.cityTag, { right: 10, top: 10 }]}>
        <Ionicons name="flag" size={11} color={colors.forest700} />
        <Text style={styles.cityText}>{destCity}</Text>
      </View>

      {/* Honest schematic label */}
      <View style={styles.schematicTag}>
        <Ionicons name="git-network-outline" size={11} color={colors.inkSoft} />
        <Text style={styles.schematicText}>Schematic · illustrative, not to scale</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.mapBase, overflow: 'hidden' },
  pinHit: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'flex-start' },
  pinLabel: { position: 'absolute', top: -22, backgroundColor: colors.forest700, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, maxWidth: 160, ...shadow.card },
  pinLabelText: { color: colors.white, fontSize: font.tiny, fontWeight: '700' },
  cityTag: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  cityText: { fontSize: font.small, fontWeight: '800', color: colors.forest800 },
  schematicTag: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  schematicText: { fontSize: font.tiny, color: colors.inkSoft, fontWeight: '600' },
});
