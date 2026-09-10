import type { ReactNode } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet, type ViewStyle, type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font, control } from '../theme';

/** A white grouped container (iOS "inset grouped" cell block). Flat on the grey bg. */
export function Group({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.group, style]}>{children}</View>;
}

/** Alias kept for existing call sites — a padded white surface. */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}
export function H2({ children }: { children: ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}
export function Muted({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}
export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

/** Section header above a Group — small grey caps, iOS grouped style. */
export function SectionHeading({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionText}>{title}</Text>
      {right}
    </View>
  );
}

/** Standard navigation header: leading back chevron, centred title, optional right. */
export function NavBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.nav}>
      <View style={styles.navSide}>
        {onBack && (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.navBack}>
            <Ionicons name="chevron-back" size={26} color={colors.forest700} />
          </Pressable>
        )}
      </View>
      <Text style={styles.navTitle} numberOfLines={1}>{title}</Text>
      <View style={[styles.navSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function PrimaryButton({
  title, onPress, disabled, loading, accent,
}: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean; accent?: boolean }) {
  // `accent` renders a secondary (tinted) emphasis; default is the filled primary.
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading) }}
      style={({ pressed }) => [
        styles.btn,
        accent ? styles.btnSecondary : styles.btnPrimary,
        (disabled || loading) && styles.btnDisabled,
        pressed && { opacity: 0.85 },
      ]}
    >
      {loading && <ActivityIndicator color={accent ? colors.forest700 : colors.white} style={{ marginRight: 8 }} />}
      <Text style={[styles.btnText, accent && { color: colors.forest700 }]}>{title}</Text>
    </Pressable>
  );
}

export function GhostButton({ title, onPress, danger, style }: { title: string; onPress: () => void; danger?: boolean; style?: ViewStyle }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.6 }, style]}>
      <Text style={[styles.ghostText, danger && { color: colors.red700 }]}>{title}</Text>
    </Pressable>
  );
}

export function Loading() {
  return <View style={{ paddingVertical: space.xl, alignItems: 'center' }}><ActivityIndicator color={colors.forest700} /></View>;
}

export function ErrorRow({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorRow}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && <Pressable onPress={onRetry} accessibilityRole="button"><Text style={styles.errorRetry}>Retry</Text></Pressable>}
    </View>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {children ? <Text style={styles.emptyBody}>{children}</Text> : null}
    </View>
  );
}

/** Subtle hairline separator, inset from the left to align with row content. */
export function Separator({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: inset }} />;
}

/** Compact selectable chip — forest fill when selected (no lime). */
export function Chip({
  label, selected, onPress, accessibilityLabel,
}: { label: string; selected?: boolean; onPress?: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipIdle,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.white : colors.inkSoft }]}>{label}</Text>
    </Pressable>
  );
}

export interface Seg<T extends string> { value: T; label: string }

/** iOS-style compact segmented control: grey track, white selected thumb. */
export function Segmented<T extends string>({
  segments, value, onChange, accessibilityLabel,
}: { segments: Seg<T>[]; value: T; onChange: (v: T) => void; accessibilityLabel?: string }) {
  return (
    <View style={styles.segTrack} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {segments.map((s) => {
        const on = s.value === value;
        return (
          <Pressable key={s.value} onPress={() => onChange(s.value)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.seg, on && styles.segOn]}>
            <Text style={[styles.segText, on && styles.segTextOn]} numberOfLines={1}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Circular icon button with a comfortable hit area (subtle, not tinted). */
export function IconButton({
  name, onPress, accessibilityLabel, tone = 'plain', size = 24,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: 'plain' | 'brand';
  size?: number;
}) {
  const fg = tone === 'brand' ? colors.forest700 : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.5 }]}
    >
      <Ionicons name={name} size={size} color={fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg },
  h1: { fontSize: font.h1, fontWeight: '700', color: colors.ink, letterSpacing: 0.2 },
  h2: { fontSize: font.h2, fontWeight: '700', color: colors.ink },
  muted: { fontSize: font.body, color: colors.muted },
  label: { fontSize: font.tiny, fontWeight: '400', color: colors.muted, marginBottom: 6 },

  section: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.xs, paddingHorizontal: space.xs },
  sectionText: { fontSize: font.tiny, fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.4, color: colors.muted },

  nav: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs },
  navSide: { minWidth: 60, justifyContent: 'center' },
  navBack: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: font.title, fontWeight: '600', color: colors.ink },

  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, paddingHorizontal: 20, minHeight: control.height },
  btnPrimary: { backgroundColor: colors.forest700 },
  btnSecondary: { backgroundColor: colors.surfaceAlt },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: colors.white, fontWeight: '600', fontSize: font.body },
  ghost: { alignItems: 'center', justifyContent: 'center', minHeight: control.small, paddingHorizontal: 16 },
  ghostText: { color: colors.forest700, fontWeight: '500', fontSize: font.body },

  errorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: colors.red100, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14 },
  errorText: { color: colors.red700, fontSize: font.small, flexShrink: 1 },
  errorRetry: { color: colors.red700, fontWeight: '600', fontSize: font.small },
  empty: { borderRadius: radius.lg, paddingVertical: 40, paddingHorizontal: 20, alignItems: 'center', backgroundColor: colors.surface },
  emptyTitle: { fontWeight: '600', color: colors.ink, fontSize: font.title },
  emptyBody: { marginTop: 6, color: colors.muted, textAlign: 'center', fontSize: font.small },

  chip: { borderRadius: radius.pill, paddingHorizontal: 14, minHeight: control.small, alignItems: 'center', justifyContent: 'center' },
  chipIdle: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.forest700 },
  chipText: { fontWeight: '600', fontSize: font.small },

  segTrack: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 2 },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: radius.md - 2, minHeight: 36 },
  segOn: { backgroundColor: colors.surface, ...{ shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 } },
  segText: { fontSize: font.small, fontWeight: '500', color: colors.inkSoft },
  segTextOn: { color: colors.ink, fontWeight: '600' },

  iconBtn: { width: control.small, height: control.small, alignItems: 'center', justifyContent: 'center' },
});
