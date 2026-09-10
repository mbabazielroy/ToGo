import {
  forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode,
} from 'react';
import {
  View, Animated, PanResponder, StyleSheet, ScrollView, Pressable,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, shadow, font } from '../theme';
import { useReducedMotion } from '../lib/feedback';

export type SnapName = 'collapsed' | 'intermediate' | 'expanded';
export interface BottomSheetHandle {
  snapTo: (name: SnapName) => void;
  expand: () => void;
  collapse: () => void;
}

const ORDER: SnapName[] = ['expanded', 'intermediate', 'collapsed']; // increasing translateY

/**
 * A draggable bottom sheet built on RN's Animated + PanResponder — no extra native
 * modules, so it runs in Expo Go. Snaps between collapsed / intermediate / expanded.
 * Dragging the handle resizes it; the header stays visible; the body scrolls when
 * expanded. Accessible expand/collapse buttons are provided as drag alternatives, and
 * "reduce motion" turns the spring into an instant snap.
 */
export const BottomSheet = forwardRef<BottomSheetHandle, {
  header?: ReactNode;
  children: ReactNode;
  collapsedHeight?: number;
  topInset?: number;
  initial?: SnapName;
  onSnapChange?: (name: SnapName) => void;
}>(function BottomSheet(
  { header, children, collapsedHeight = 168, topInset = 72, initial = 'intermediate', onSnapChange },
  ref,
) {
  const [h, setH] = useState(0);
  const reduced = useReducedMotion();
  const translateY = useRef(new Animated.Value(0)).current;
  const yVal = useRef(0);
  const current = useRef<SnapName>(initial);
  const started = useRef(false);

  const snaps = useMemo(() => {
    if (h === 0) return null;
    return {
      expanded: topInset,
      intermediate: Math.max(topInset + 40, h * 0.46),
      collapsed: Math.max(topInset + 80, h - collapsedHeight),
    } as Record<SnapName, number>;
  }, [h, collapsedHeight, topInset]);

  useEffect(() => {
    const id = translateY.addListener(({ value }) => { yVal.current = value; });
    return () => translateY.removeListener(id);
  }, [translateY]);

  const goTo = useMemo(() => (name: SnapName, animate = true) => {
    if (!snaps) return;
    const changed = current.current !== name;
    current.current = name;
    if (changed) onSnapChange?.(name);
    if (!animate || reduced) { translateY.setValue(snaps[name]); return; }
    Animated.spring(translateY, {
      toValue: snaps[name], useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.7,
    }).start();
  }, [snaps, reduced, onSnapChange, translateY]);

  // Position the sheet once we know our height (and keep it valid across rotation).
  useEffect(() => {
    if (!snaps) return;
    goTo(current.current, started.current);
    started.current = true;
  }, [snaps, goTo]);

  useImperativeHandle(ref, () => ({
    snapTo: (name) => goTo(name),
    expand: () => goTo('expanded'),
    collapse: () => goTo('collapsed'),
  }), [goTo]);

  const step = (dir: -1 | 1) => {
    const idx = ORDER.indexOf(current.current);
    const next = Math.min(ORDER.length - 1, Math.max(0, idx + dir));
    goTo(ORDER[next]);
  };

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => {
      translateY.stopAnimation();
      translateY.setOffset(yVal.current);
      translateY.setValue(0);
    },
    onPanResponderMove: (_, g) => {
      // Offset base is applied via setOffset in grant; snap-clamping happens on release.
      translateY.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      translateY.flattenOffset();
      if (!snaps) return;
      const pos = Math.min(snaps.collapsed, Math.max(snaps.expanded, yVal.current));
      const nearest = ORDER
        .map((n) => ({ n, v: snaps[n] }))
        .reduce((a, b) => (Math.abs(b.v - pos) < Math.abs(a.v - pos) ? b : a));
      const idx = ORDER.indexOf(nearest.n);
      let target = nearest.n;
      if (g.vy > 0.6 && idx < ORDER.length - 1) target = ORDER[idx + 1];
      else if (g.vy < -0.6 && idx > 0) target = ORDER[idx - 1];
      goTo(target);
    },
  }), [snaps, goTo, translateY]);

  const onLayout = (e: LayoutChangeEvent) => setH(e.nativeEvent.layout.height);

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="box-none">
      <Animated.View
        style={[styles.sheet, { height: h || undefined, transform: [{ translateY }] }]}
        // Height equals container; translateY reveals only part of it.
      >
        {/* Drag handle + accessible controls */}
        <View style={styles.handleZone} {...pan.panHandlers}>
          <View style={styles.grip} />
          <View style={styles.handleControls} pointerEvents="box-none">
            <Pressable
              onPress={() => step(-1)}
              accessibilityRole="button"
              accessibilityLabel="Expand sheet"
              hitSlop={10}
              style={({ pressed }) => [styles.ctrl, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="chevron-up" size={18} color={colors.forest600} />
            </Pressable>
            <Pressable
              onPress={() => step(1)}
              accessibilityRole="button"
              accessibilityLabel="Collapse sheet"
              hitSlop={10}
              style={({ pressed }) => [styles.ctrl, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="chevron-down" size={18} color={colors.forest600} />
            </Pressable>
          </View>
        </View>

        {header ? <View style={styles.header}>{header}</View> : null}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0, right: 0, top: 0,
    backgroundColor: colors.sand50,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    ...shadow.sheet,
  },
  handleZone: { paddingTop: 8, paddingBottom: 6, alignItems: 'center' },
  grip: { width: 40, height: 5, borderRadius: 999, backgroundColor: colors.separator },
  handleControls: { position: 'absolute', right: 10, top: 4, flexDirection: 'row', gap: 2 },
  ctrl: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: space.lg, paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  body: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xxl * 2 },
});
