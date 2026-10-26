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
  title, onPress, disabled, loading, accent, icon, danger,
}: {
  title: string; onPress: () => void; disabled?: boolean; loading?: boolean; accent?: boolean;
  icon?: keyof typeof Ionicons.glyphMap; danger?: boolean;
}) {
  // `accent` renders a secondary (grey) emphasis; `danger` a red fill; default is the filled primary.
  const fg = accent ? colors.forest700 : colors.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading) }}
      style={({ pressed }) => [
        styles.btn,
        accent ? styles.btnSecondary : danger ? styles.btnDanger : styles.btnPrimary,
        (disabled || loading) && styles.btnDisabled,
        pressed && { opacity: 0.85 },
      ]}
    >
      {loading && <ActivityIndicator color={fg} style={{ marginRight: 8 }} />}
      {!loading && icon && <Ionicons name={icon} size={19} color={fg} style={{ marginRight: 8 }} />}
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


/** Large screen title for tab roots, with an optional trailing action. */
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.pageHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pageTitle} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Standard tappable list row: leading icon, title/subtitle, trailing value + chevron. */
export function ListRow({
  icon, iconColor, title, subtitle, value, onPress, danger, chevron = true, right,
}: {
  icon?: keyof typeof Ionicons.glyphMap; iconColor?: string; title: string; subtitle?: string; value?: string;
  onPress?: () => void; danger?: boolean; chevron?: boolean; right?: ReactNode;
}) {
  const body = (
    <>
      {icon && (
        <View style={[styles.rowIcon, { backgroundColor: (iconColor ?? colors.forest700) + '1A' }]}>
          <Ionicons name={icon} size={18} color={danger ? colors.red700 : iconColor ?? colors.forest700} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowTitle, danger && { color: colors.red700 }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
      {right}
      {onPress && chevron && <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
    </>
  );
  if (!onPress) return <View style={styles.listRow}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.forest50 }]}>
      {body}
    </Pressable>
  );
}

/** Label/value pair inside a Group. */
export function KeyValue({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={[styles.kvValue, tone ? { color: tone } : null]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

/** Inline status banner. */
export function Banner({ tone = 'info', icon, title, children }: {
  tone?: 'info' | 'warn' | 'error' | 'ok'; icon?: keyof typeof Ionicons.glyphMap; title?: string; children?: ReactNode;
}) {
  const map = {
    info: { bg: colors.blue100, fg: colors.blue800, icon: 'information-circle' as const },
    warn: { bg: colors.amber100, fg: colors.amber800, icon: 'warning' as const },
    error: { bg: colors.red100, fg: colors.red700, icon: 'alert-circle' as const },
    ok: { bg: colors.forest100, fg: colors.forest800, icon: 'checkmark-circle' as const },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: map.bg }]} accessibilityRole="alert">
      <Ionicons name={icon ?? map.icon} size={18} color={map.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        {title ? <Text style={[styles.bannerTitle, { color: map.fg }]}>{title}</Text> : null}
        {children ? <Text style={[styles.bannerText, { color: map.fg }]}>{children}</Text> : null}
      </View>
    </View>
  );
}

/** Compact metric tile for dashboards. */
export function StatTile({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}>
      <Text style={[styles.statValue, tone ? { color: tone } : null]} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      {hint ? <Text style={styles.statHint} numberOfLines={1}>{hint}</Text> : null}
    </View>
  );
}

/** Operator line badge (coloured code), like a route bullet in a transit app. */
export function LineBadge({ code, color, text = colors.white, size = 'md' }: { code: string; color: string; text?: string; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'lg' ? { minWidth: 52, height: 30, fontSize: 15 } : size === 'sm' ? { minWidth: 36, height: 20, fontSize: 11 } : { minWidth: 44, height: 24, fontSize: 13 };
  return (
    <View style={[styles.line, { backgroundColor: color, minWidth: dims.minWidth, height: dims.height }]}>
      <Text style={[styles.lineText, { color: text, fontSize: dims.fontSize }]}>{code}</Text>
    </View>
  );
}

/** Initials avatar. */
export function Avatar({ name, color = colors.forest700, size = 40 }: { name: string; color?: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.white, fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
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
  btnDanger: { backgroundColor: colors.red600 },
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

  pageHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, paddingTop: space.sm, paddingBottom: space.sm },
  pageTitle: { fontSize: 32, fontWeight: '800', color: colors.ink, letterSpacing: -0.6 },
  pageSubtitle: { fontSize: font.small, color: colors.muted, marginTop: 2 },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.lg, paddingVertical: 11, minHeight: control.row + 8 },
  rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: font.body, color: colors.ink, fontWeight: '500' },
  rowSub: { fontSize: font.tiny, color: colors.muted, marginTop: 2, lineHeight: 17 },
  rowValue: { fontSize: font.small, color: colors.muted, maxWidth: '45%' },

  kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44, paddingVertical: 8 },
  kvLabel: { fontSize: font.small, color: colors.muted },
  kvValue: { fontSize: font.small, color: colors.ink, fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  banner: { flexDirection: 'row', gap: 10, borderRadius: radius.lg, padding: space.md },
  bannerTitle: { fontSize: font.small, fontWeight: '700' },
  bannerText: { fontSize: font.small, lineHeight: 20 },

  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: space.md, paddingHorizontal: space.md, minWidth: 96 },
  statValue: { fontSize: 26, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  statLabel: { fontSize: font.tiny, color: colors.inkSoft, marginTop: 2, fontWeight: '600' },
  statHint: { fontSize: 12, color: colors.muted, marginTop: 1 },

  line: { borderRadius: 6, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  lineText: { fontWeight: '900', letterSpacing: 0.5 },
});
