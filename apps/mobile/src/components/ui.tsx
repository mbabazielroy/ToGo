import type { ReactNode } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet, type ViewStyle, type TextStyle,
} from 'react-native';
import { colors, radius, space, font, shadow } from '../theme';

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
      style={({ pressed }) => [styles.ghost, danger && styles.ghostDanger, pressed && { opacity: 0.9 }, style]}>
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
      {onRetry && <Pressable onPress={onRetry}><Text style={styles.errorRetry}>Retry</Text></Pressable>}
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

export function DemoBadge() {
  return (
    <View style={styles.demoBadge}>
      <Text style={styles.demoBadgeText}>
        Demo mode · Illustrative operators, hubs, fares & tracking — no real bookings or pickups.
      </Text>
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

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.xl, padding: space.lg, ...shadow.card },
  h1: { fontSize: font.h1, fontWeight: '800', color: colors.forest900 },
  h2: { fontSize: font.h2, fontWeight: '800', color: colors.forest900 },
  muted: { fontSize: font.body, color: colors.muted },
  label: { fontSize: font.tiny, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.forest600, marginBottom: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, paddingVertical: 15, paddingHorizontal: 20, minHeight: 50 },
  btnPrimary: { backgroundColor: colors.forest700 },
  btnAccent: { backgroundColor: colors.lime400 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.white, fontWeight: '700', fontSize: font.body },
  ghost: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, paddingVertical: 13, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.forest200, backgroundColor: colors.white, minHeight: 46 },
  ghostDanger: { borderColor: colors.red100 },
  ghostText: { color: colors.forest700, fontWeight: '700', fontSize: font.small },
  errorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: colors.red100, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12 },
  errorText: { color: colors.red700, fontSize: font.small, flexShrink: 1 },
  errorRetry: { color: colors.red700, fontWeight: '800', fontSize: font.small, textDecorationLine: 'underline' },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.forest200, borderRadius: radius.xl, paddingVertical: 36, paddingHorizontal: 20, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
  emptyTitle: { fontWeight: '800', color: colors.forest800, fontSize: font.title },
  emptyBody: { marginTop: 6, color: colors.muted, textAlign: 'center', fontSize: font.small },
  demoBadge: { backgroundColor: colors.forest900, paddingVertical: 5, paddingHorizontal: 16 },
  demoBadgeText: { color: colors.lime200, fontSize: font.tiny, textAlign: 'center', fontWeight: '600' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm },
  sectionText: { fontSize: font.small, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.forest600 },
});
