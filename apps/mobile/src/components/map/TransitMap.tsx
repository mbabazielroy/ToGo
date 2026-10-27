import { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, font } from '../../theme';
import { regionFor } from '@shared/data/geo';
import type { TransitMapProps } from './types';

/**
 * Transit-style map: coloured route lines, stops (with optional pickup counts),
 * and buses. Apple Maps on iOS, Google Maps on Android — both available in Expo Go.
 * (Web uses TransitMap.web.tsx, a drawn schematic with the same props.)
 */
export function TransitMap({ height, routes = [], stops = [], buses = [], focus, caption, onStopPress }: TransitMapProps) {
  const ref = useRef<MapView>(null);
  const fit = useMemo(
    () => focus ?? [...routes.flatMap((r) => r.path), ...stops.map((s) => s.coord), ...buses.map((b) => b.coord)],
    [focus, routes, stops, buses],
  );
  const fitKey = fit.map((p) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`).join('|');

  useEffect(() => {
    if (fit.length < 2) return;
    const t = setTimeout(() => ref.current?.fitToCoordinates(fit, { edgePadding: { top: 48, right: 40, bottom: 40, left: 40 }, animated: true }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={regionFor(fit)}
        showsPointsOfInterests={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        accessibilityLabel="Map"
      >
        {routes.map((r) => (
          <Polyline key={r.id} coordinates={r.path} strokeColor={r.dimmed ? colors.faint : r.color} strokeWidth={r.dimmed ? 3 : 5} lineCap="round" lineJoin="round" />
        ))}
        {stops.map((s) => (
          <Marker key={s.id} coordinate={s.coord} title={s.label} anchor={{ x: 0.5, y: 0.5 }} onPress={() => onStopPress?.(s.id)} tracksViewChanges={false}>
            <View style={[styles.stop, { borderColor: s.passed ? colors.faint : s.color ?? colors.forest700 }, s.highlight && styles.stopHi, s.passed && { backgroundColor: colors.surfaceAlt }]}>
              {s.badge != null && s.badge > 0 ? <Text style={styles.badgeText}>{s.badge}</Text> : null}
            </View>
          </Marker>
        ))}
        {buses.map((b) => (
          <Marker key={`${b.id}:${b.coord.latitude.toFixed(4)},${b.coord.longitude.toFixed(4)}`} coordinate={b.coord} anchor={{ x: 0.5, y: 0.5 }} title={b.label} tracksViewChanges={false}>
            <View style={[styles.bus, { backgroundColor: b.color }]}>
              <Ionicons name="bus" size={14} color={colors.white} />
              {b.label ? <Text style={styles.busText}>{b.label}</Text> : null}
            </View>
          </Marker>
        ))}
      </MapView>
      {caption ? <View style={styles.caption}><Text style={styles.captionText}>{caption}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  stop: { minWidth: 18, height: 18, borderRadius: 9, borderWidth: 3, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  stopHi: { minWidth: 24, height: 24, borderRadius: 12, borderWidth: 4 },
  badgeText: { fontSize: 10, fontWeight: '900', color: colors.ink },
  bus: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 2, borderColor: colors.white },
  busText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  caption: { position: 'absolute', left: 10, top: 10, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  captionText: { fontSize: font.tiny, fontWeight: '700', color: colors.inkSoft },
});
