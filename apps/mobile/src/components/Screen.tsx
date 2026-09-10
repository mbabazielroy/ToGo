import type { ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space, font } from '../theme';
import { useAppMode } from '../data/AdapterProvider';
import { DemoBadge } from './ui';

function BrandHeader({ subtitle }: { subtitle?: string }) {
  const mode = useAppMode();
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.logo}><Text style={styles.logoText}>T</Text></View>
        <Text style={styles.brand}>To<Text style={{ color: colors.lime300 }}>Go</Text></Text>
        <View style={styles.modeTag}>
          <Text style={styles.modeTagText}>{mode === 'connected' ? 'Connected pilot' : 'Demo'}</Text>
        </View>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Standard screen: safe-area, deep-green brand header, demo badge, scrollable body. */
export function Screen({
  children, scroll = true, subtitle, showHeader = true,
}: { children: ReactNode; scroll?: boolean; subtitle?: string; showHeader?: boolean }) {
  const insets = useSafeAreaInsets();
  const mode = useAppMode();
  const Body = scroll ? ScrollView : View;
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {showHeader && <BrandHeader subtitle={subtitle} />}
      {mode === 'demo' && <DemoBadge />}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Body
          style={{ flex: 1 }}
          contentContainerStyle={scroll ? { padding: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.md } : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </Body>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sand100 },
  header: { backgroundColor: colors.forest700, paddingHorizontal: space.lg, paddingVertical: space.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.lime400, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.forest900, fontWeight: '900', fontSize: 16 },
  brand: { color: colors.white, fontWeight: '900', fontSize: font.h2 },
  modeTag: { marginLeft: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  modeTagText: { color: colors.lime200, fontSize: font.tiny, fontWeight: '700' },
  subtitle: { color: colors.lime200, fontSize: font.tiny, marginTop: 4 },
});
