import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, type LayoutChangeEvent } from 'react-native';
import Svg, { Polyline, Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, font } from '../../theme';
import type { LatLng } from '@shared/data/geo';
import type { TransitMapProps } from './types';

/** Web fallback (react-native-maps has no web support): the same routes, stops, buses
 *  and interactions drawn as a schematic. */
export function TransitMap({
  height, fill, routes = [], stops = [], buses = [], focus, caption, selectedId,
  onStopPress, onBusPress, onMapPress, onPress, follow, userLocation, bottomInset = 0, topInset = 0,
}: TransitMapProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pts = useMemo(() => {
    if (follow) {
      const d = 0.06; // ~ a few km around the followed bus
      return [{ latitude: follow.latitude - d, longitude: follow.longitude - d }, { latitude: follow.latitude + d, longitude: follow.longitude + d }];
    }
    return focus ?? [...routes.flatMap((r) => r.path), ...stops.map((s) => s.coord), ...buses.map((b) => b.coord)];
  }, [follow, focus, routes, stops, buses]);
  const w = size.w, h = fill ? size.h : height ?? 200;

  const project = useMemo(() => {
    const lats = pts.map((p) => p.latitude), lngs = pts.map((p) => p.longitude);
    let minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    if (maxLat - minLat < 0.01) { minLat -= 0.005; maxLat += 0.005; }
    if (maxLng - minLng < 0.01) { minLng -= 0.005; maxLng += 0.005; }
    const pad = 32;
    const iw = Math.max(1, w - pad * 2), ih = Math.max(1, h - pad * 2 - bottomInset - topInset);
    const scale = Math.min(iw / (maxLng - minLng), ih / (maxLat - minLat));
    const ox = pad + (iw - (maxLng - minLng) * scale) / 2, oy = pad + topInset + (ih - (maxLat - minLat) * scale) / 2;
    return (p: LatLng) => ({ x: ox + (p.longitude - minLng) * scale, y: oy + (maxLat - p.latitude) * scale });
  }, [pts, w, h, bottomInset, topInset]);

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <View style={[styles.wrap, fill ? StyleSheet.absoluteFill : { height }, fill && { borderRadius: 0 }]} onLayout={onLayout} accessibilityLabel="Route map">
      {w > 0 && h > 0 && pts.length > 0 && (
        <Svg width={w} height={h}>
          {routes.map((r) => (
            <Polyline key={r.id} points={r.path.map((p) => { const q = project(p); return `${q.x},${q.y}`; }).join(' ')}
              fill="none" stroke={r.dimmed ? 'rgba(120,120,128,0.45)' : r.color} strokeWidth={r.dimmed ? 3 : 6} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {stops.map((s) => {
            const q = project(s.coord);
            const sel = selectedId === s.id;
            const r = s.highlight || sel ? 10 : 7;
            return (
              <G key={s.id}>
                <Circle cx={q.x} cy={q.y} r={r} fill={sel ? s.color ?? colors.forest700 : s.passed ? colors.surfaceAlt : colors.white} stroke={s.passed ? colors.faint : s.color ?? colors.forest700} strokeWidth={s.highlight || sel ? 4 : 3} />
                {s.badge != null && s.badge > 0 && <SvgText x={q.x} y={q.y + 3.5} fontSize={10} fontWeight="900" fill={sel ? colors.white : colors.ink} textAnchor="middle">{s.badge}</SvgText>}
                {sel && (
                  <G>
                    <Rect x={Math.min(Math.max(4, q.x - 70), w - 144)} y={q.y + 14} width={140} height={20} rx={8} fill={colors.ink} />
                    <SvgText x={Math.min(Math.max(74, q.x), w - 74)} y={q.y + 28} fontSize={11} fontWeight="700" fill={colors.white} textAnchor="middle">{s.label.length > 22 ? `${s.label.slice(0, 21)}…` : s.label}</SvgText>
                  </G>
                )}
              </G>
            );
          })}
          {buses.map((b) => {
            const q = project(b.coord);
            const sel = selectedId === b.id;
            const bw = sel ? 40 : 32, bh = sel ? 26 : 22;
            return (
              <G key={b.id}>
                <Rect x={q.x - bw / 2} y={q.y - bh / 2} width={bw} height={bh} rx={bh / 2} fill={b.color} stroke={colors.white} strokeWidth={sel ? 3 : 2} />
                <SvgText x={q.x} y={q.y + 4} fontSize={10} fontWeight="800" fill={colors.white} textAnchor="middle">{b.label ?? 'BUS'}</SvgText>
              </G>
            );
          })}
          {userLocation && (() => {
            const q = project(userLocation);
            return (
              <G>
                <Circle cx={q.x} cy={q.y} r={13} fill="rgba(31,95,209,0.2)" />
                <Circle cx={q.x} cy={q.y} r={7} fill="#1f5fd1" stroke={colors.white} strokeWidth={2.5} />
              </G>
            );
          })()}
        </Svg>
      )}
      {/* Tap targets: react-native-svg drops press handlers on web, so stops and buses
          get transparent 44pt buttons layered over the drawing. */}
      {w > 0 && h > 0 && pts.length > 0 && !onPress && (
        <>
          {onMapPress && <Pressable style={StyleSheet.absoluteFill} onPress={onMapPress} accessibilityLabel="Map background" />}
          {onStopPress && stops.map((s) => {
            const q = project(s.coord);
            return <Pressable key={`hit-${s.id}`} onPress={() => onStopPress(s.id)} accessibilityRole="button" accessibilityLabel={s.label} style={[styles.hit, { left: q.x - 22, top: q.y - 22 }]} />;
          })}
          {onBusPress && buses.map((b) => {
            const q = project(b.coord);
            return <Pressable key={`hit-${b.id}`} onPress={() => onBusPress(b.id)} accessibilityRole="button" accessibilityLabel={`Bus ${b.label ?? ''}`} style={[styles.hit, { left: q.x - 22, top: q.y - 22 }]} />;
          })}
        </>
      )}
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
  wrap: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#e8efe9' },
  hit: { position: 'absolute', width: 44, height: 44, borderRadius: 22 },
  caption: { position: 'absolute', left: 10, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  captionText: { fontSize: font.tiny, fontWeight: '700', color: colors.inkSoft },
  expand: { position: 'absolute', right: 10, bottom: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' },
});
