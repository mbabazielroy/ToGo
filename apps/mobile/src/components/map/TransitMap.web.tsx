import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Polyline, Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import { colors, radius, font } from '../../theme';
import type { LatLng } from '@shared/data/geo';
import type { TransitMapProps } from './types';

/** Web fallback (react-native-maps has no web support): the same routes, stops and
 *  buses drawn as a schematic on a plain background. */
export function TransitMap({ height, routes = [], stops = [], buses = [], focus, caption }: TransitMapProps) {
  const [width, setWidth] = useState(0);
  const pts = useMemo(
    () => focus ?? [...routes.flatMap((r) => r.path), ...stops.map((s) => s.coord), ...buses.map((b) => b.coord)],
    [focus, routes, stops, buses],
  );
  const project = useMemo(() => {
    const lats = pts.map((p) => p.latitude), lngs = pts.map((p) => p.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const pad = 28;
    const w = Math.max(1, width - pad * 2), h = Math.max(1, height - pad * 2);
    const spanLng = Math.max(1e-4, maxLng - minLng), spanLat = Math.max(1e-4, maxLat - minLat);
    const scale = Math.min(w / spanLng, h / spanLat);
    const ox = pad + (w - spanLng * scale) / 2, oy = pad + (h - spanLat * scale) / 2;
    return (p: LatLng) => ({ x: ox + (p.longitude - minLng) * scale, y: oy + (maxLat - p.latitude) * scale });
  }, [pts, width, height]);

  return (
    <View style={[styles.wrap, { height }]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessibilityLabel="Route map">
      {width > 0 && pts.length > 0 && (
        <Svg width={width} height={height}>
          {routes.map((r) => (
            <Polyline key={r.id} points={r.path.map((p) => { const q = project(p); return `${q.x},${q.y}`; }).join(' ')}
              fill="none" stroke={r.dimmed ? colors.faint : r.color} strokeWidth={r.dimmed ? 3 : 5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {stops.map((s) => {
            const q = project(s.coord);
            const r = s.highlight ? 9 : 7;
            return (
              <G key={s.id}>
                <Circle cx={q.x} cy={q.y} r={r} fill={s.passed ? colors.surfaceAlt : colors.white} stroke={s.passed ? colors.faint : s.color ?? colors.forest700} strokeWidth={s.highlight ? 4 : 3} />
                {s.badge != null && s.badge > 0 && <SvgText x={q.x} y={q.y + 3.5} fontSize={10} fontWeight="900" fill={colors.ink} textAnchor="middle">{s.badge}</SvgText>}
              </G>
            );
          })}
          {buses.map((b) => {
            const q = project(b.coord);
            return (
              <G key={b.id}>
                <Rect x={q.x - 16} y={q.y - 11} width={32} height={22} rx={11} fill={b.color} stroke={colors.white} strokeWidth={2} />
                <SvgText x={q.x} y={q.y + 4} fontSize={10} fontWeight="800" fill={colors.white} textAnchor="middle">{b.label ?? 'BUS'}</SvgText>
              </G>
            );
          })}
        </Svg>
      )}
      {caption ? <View style={styles.caption}><Text style={styles.captionText}>{caption}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#e8efe9' },
  caption: { position: 'absolute', left: 10, top: 10, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  captionText: { fontSize: font.tiny, fontWeight: '700', color: colors.inkSoft },
});
