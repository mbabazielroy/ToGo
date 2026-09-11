import type { ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space, font, SCREEN } from '../theme';
import { useAppMode } from '../data/AdapterProvider';

export const DEMO_EXPLANATION =
  'Preview mode uses simulated operators, hubs, fares, staff and tracking. Nothing here books a real seat or arranges a real pickup — everything is stored only on this device so you can explore the full workflow.';

/** Compact, tappable mode indicator (Preview / Connected). Tapping Preview explains it. */
export function ModeTag() {
  const mode = useAppMode();
  const demo = mode === 'demo';
  return (
    <Pressable
      onPress={() => demo && Alert.alert('Preview mode', DEMO_EXPLANATION)}
      accessibilityRole={demo ? 'button' : undefined}
      accessibilityLabel={demo ? 'Preview mode. Data is simulated. Tap to learn more.' : 'Connected pilot'}
      hitSlop={8}
      style={[styles.modeTag, demo ? styles.modeTagDemo : styles.modeTagLive]}
    >
      <Text style={[styles.modeTagText, demo ? styles.modeTagTextDemo : styles.modeTagTextLive]}>
        {demo ? 'Preview' : 'Connected'}
      </Text>
    </Pressable>
  );
}

function BrandHeader({ subtitle }: { subtitle?: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.logo}><Text style={styles.logoText}>T</Text></View>
        <Text style={styles.brand}>ToGo</Text>
        <View style={{ flex: 1 }} />
        <ModeTag />
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Standard screen: safe-area, compact brand header, neutral off-white body. */
export function Screen({
  children, scroll = true, subtitle, showHeader = true,
}: { children: ReactNode; scroll?: boolean; subtitle?: string; showHeader?: boolean }) {
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {showHeader && <BrandHeader subtitle={subtitle} />}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Body
          style={{ flex: 1 }}
          contentContainerStyle={scroll ? { paddingHorizontal: SCREEN, paddingTop: space.md, paddingBottom: insets.bottom + space.xxl, gap: space.md } : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </Body>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: SCREEN, paddingTop: space.sm, paddingBottom: space.sm },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 24, height: 24, borderRadius: 7, backgroundColor: colors.forest700, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.white, fontWeight: '900', fontSize: 14 },
  brand: { color: colors.ink, fontWeight: '900', fontSize: font.title, letterSpacing: -0.2 },
  subtitle: { color: colors.muted, fontSize: font.small, marginTop: 2 },
  modeTag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  modeTagDemo: { backgroundColor: colors.surfaceAlt },
  modeTagLive: { backgroundColor: colors.forest100 },
  modeTagText: { fontSize: font.tiny, fontWeight: '800' },
  modeTagTextDemo: { color: colors.inkSoft },
  modeTagTextLive: { color: colors.forest700 },
});
