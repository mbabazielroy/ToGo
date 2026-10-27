import { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, font } from '../../theme';
import { regionFor } from '@shared/data/geo';
import type { TransitMapProps } from './types';

/**
 * Transit-style map: coloured route lines, tappable stops (with optional counts) and
 * buses, a selected state, follow-the-bus, and the user's position. Apple Maps on iOS,
 * Google Maps on Android — both available in Expo Go. (Web: TransitMap.web.tsx.)
 */
export function TransitMap({
  height, fill, routes = [], stops = [], buses = [], focus, caption, selectedId,
  onStopPress, onBusPress, onMapPress, onPress, follow, refitToken = 0, userLocation, bottomInset = 0, topInset = 0,
}: TransitMapProps) {
  const ref = useRef<MapView>(null);
  const fit = useMemo(
    () => focus ?? [...routes.flatMap((r) => r.path), ...stops.map((s) => s.coord), ...buses.map((b) => b.coord)],
    [focus, routes, stops, buses],
  );
  const fitKey = fit.map((p) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`).join('|');
  const padding = { top: 48 + topInset, right: 40, bottom: 40 + bottomInset, left: 40 };

  useEffect(() => {
    if (follow || fit.length === 0) return;
    const t = setTimeout(() => {
      if (fit.length === 1) ref.current?.animateCamera({ center: fit[0], zoom: 15 }, { duration: 400 });
      else ref.current?.fitToCoordinates(fit, { edgePadding: padding, animated: true });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, refitToken, bottomInset, !!follow]);

  useEffect(() => {
    if (!follow) return;
    ref.current?.animateCamera({ center: follow, zoom: 13 }, { duration: 600 });
  }, [follow?.latitude, follow?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const interactive = !onPress;

  return (
    <View style={[styles.wrap, fill ? StyleSheet.absoluteFill : { height }, fill && { borderRadius: 0 }]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={regionFor(fit)}
        showsPointsOfInterests={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        mapPadding={{ top: topInset, right: 0, bottom: bottomInset, left: 0 }}
        onPress={(e) => { if (e.nativeEvent.action !== 'marker-press') onMapPress?.(); }}
        accessibilityLabel="Map"
      >
        {routes.map((r) => (
          <Polyline key={r.id} coordinates={r.path} strokeColor={r.dimmed ? 'rgba(120,120,128,0.45)' : r.color} strokeWidth={r.dimmed ? 3 : 6} lineCap="round" lineJoin="round" zIndex={r.dimmed ? 1 : 2} />
        ))}
        {stops.map((s) => {
          const sel = selectedId === s.id;
          return (
            <Marker key={`${s.id}:${sel}:${s.badge ?? ''}:${s.passed ? 1 : 0}`} coordinate={s.coord} anchor={{ x: 0.5, y: 0.5 }} zIndex={sel ? 20 : 5}
              onPress={(e) => { e.stopPropagation?.(); onStopPress?.(s.id); }} tracksViewChanges={false} accessibilityLabel={s.label}>
              <View style={styles.stopHit}>
                <View style={[styles.stop, { borderColor: s.passed ? colors.faint : s.color ?? colors.forest700 }, (s.highlight || sel) && styles.stopHi, sel && { backgroundColor: s.color ?? colors.forest700 }, s.passed && { backgroundColor: colors.surfaceAlt }]}>
                  {s.badge != null && s.badge > 0 ? <Text style={[styles.badgeText, sel && { color: colors.white }]}>{s.badge}</Text> : null}
                </View>
                {sel && <View style={styles.tag}><Text style={styles.tagText} numberOfLines={1}>{s.label}</Text></View>}
              </View>
            </Marker>
          );
        })}
        {buses.map((b) => {
          const sel = selectedId === b.id;
          return (
            <Marker key={`${b.id}:${sel}`} coordinate={b.coord} anchor={{ x: 0.5, y: 0.5 }} zIndex={sel ? 30 : 10}
              onPress={(e) => { e.stopPropagation?.(); onBusPress?.(b.id); }} tracksViewChanges={false} accessibilityLabel={`Bus ${b.label ?? ''}`}>
              <View style={[styles.bus, { backgroundColor: b.color }, sel && styles.busSel]}>
                <Ionicons name="bus" size={sel ? 16 : 14} color={colors.white} />
                {b.label ? <Text style={styles.busText}>{b.label}</Text> : null}
              </View>
            </Marker>
          );
        })}
        {userLocation && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={40} accessibilityLabel="You are here">
            <View style={styles.meHalo}><View style={styles.me} /></View>
          </Marker>
        )}
      </MapView>
      {caption ? <View style={[styles.caption, { top: 10 + topInset }]} pointerEvents="none"><Text style={styles.captionText}>{caption}</Text></View> : null}
      {onPress && (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Open live map" style={StyleSheet.absoluteFill}>
          <View style={styles.expand}><Ionicons name="expand" size={16} color={colors.ink} /></View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  stopHit: { alignItems: 'center', padding: 6 },
  stop: { minWidth: 18, height: 18, borderRadius: 9, borderWidth: 3, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  stopHi: { minWidth: 26, height: 26, borderRadius: 13, borderWidth: 4 },
  badgeText: { fontSize: 10, fontWeight: '900', color: colors.ink },
  tag: { marginTop: 4, backgroundColor: colors.ink, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, maxWidth: 180 },
  tagText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  bus: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 2, borderColor: colors.white },
  busSel: { paddingHorizontal: 11, paddingVertical: 7, borderWidth: 3, transform: [{ scale: 1.1 }] },
  busText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  meHalo: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(31,95,209,0.2)', alignItems: 'center', justifyContent: 'center' },
  me: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#1f5fd1', borderWidth: 2.5, borderColor: colors.white },
  caption: { position: 'absolute', left: 10, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  captionText: { fontSize: font.tiny, fontWeight: '700', color: colors.inkSoft },
  expand: { position: 'absolute', right: 10, bottom: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' },
});
