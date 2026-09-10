import type { ReactNode } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet, type ViewStyle, type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font, control } from '../theme';

/** A quiet grouping surface: white, hairline border, no heavy shadow. */
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

export function PrimaryButton({
  title, onPress, disabled, loading, accent,
}: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean; accent?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading) }}
      style={({ pressed }) => [
        styles.btn,
        accent ? styles.btnAccent : styles.btnPrimary,
        (disabled || loading) && styles.btnDisabled,
        pressed && { opacity: 0.9 },
      ]}
    >
      {loading && <ActivityIndicator color={accent ? colors.forest900 : colors.white} style={{ marginRight: 8 }} />}
      <Text style={[styles.btnText, accent && { color: colors.forest900 }]}>{title}</Text>
    </Pressable>
  );
}

export function GhostButton({ title, onPress, danger, style }: { title: string; onPress: () => void; danger?: boolean; style?: ViewStyle }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [styles.ghost, danger && styles.ghostDanger, pressed && { opacity: 0.85 }, style]}>
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

export function SectionHeading({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionText}>{title}</Text>
      {right}
    </View>
  );
}

/** Subtle hairline separator — preferred over nesting extra cards. */
export function Separator({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: inset }} />;
}

/** Compact selectable chip (lime when selected — the one place lime is used). */
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
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.forest900 : colors.inkSoft }]}>{label}</Text>
    </Pressable>
  );
}

/** Circular icon button with a comfortable hit area. */
export function IconButton({
  name, onPress, accessibilityLabel, tone = 'surface', size = 22,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: 'surface' | 'brand' | 'ghost';
  size?: number;
}) {
  const bg = tone === 'brand' ? colors.forest700 : tone === 'ghost' ? 'transparent' : colors.surface;
  const fg = tone === 'brand' ? colors.white : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconBtn,
        { backgroundColor: bg },
        tone === 'surface' && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Ionicons name={name} size={size} color={fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  h1: { fontSize: font.h1, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  h2: { fontSize: font.h2, fontWeight: '800', color: colors.ink },
  muted: { fontSize: font.body, color: colors.muted },
  label: { fontSize: font.tiny, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.muted, marginBottom: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingHorizontal: 20, minHeight: control.height },
  btnPrimary: { backgroundColor: colors.forest700 },
  btnAccent: { backgroundColor: colors.lime400 },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: colors.white, fontWeight: '700', fontSize: font.body },
  ghost: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, minHeight: control.small, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  ghostDanger: { borderColor: colors.red100 },
  ghostText: { color: colors.forest700, fontWeight: '700', fontSize: font.small },
  errorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: colors.red100, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14 },
  errorText: { color: colors.red700, fontSize: font.small, flexShrink: 1 },
  errorRetry: { color: colors.red700, fontWeight: '800', fontSize: font.small, textDecorationLine: 'underline' },
  empty: { borderWidth: 1, borderColor: colors.separator, borderRadius: radius.lg, paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center', backgroundColor: colors.surface },
  emptyTitle: { fontWeight: '800', color: colors.ink, fontSize: font.title },
  emptyBody: { marginTop: 6, color: colors.muted, textAlign: 'center', fontSize: font.small },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.sm },
  sectionText: { fontSize: font.small, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.muted },
  chip: { borderRadius: radius.pill, paddingHorizontal: 14, minHeight: control.small, alignItems: 'center', justifyContent: 'center' },
  chipIdle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.lime400, borderWidth: 1, borderColor: colors.lime500 },
  chipText: { fontWeight: '700', fontSize: font.small },
  iconBtn: { width: control.small, height: control.small, borderRadius: control.small / 2, alignItems: 'center', justifyContent: 'center' },
});
