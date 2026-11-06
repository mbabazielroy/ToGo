import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from './ui';
import { colors, space, font, SCREEN } from '../theme';
import { BrandMark } from './BrandMark';

export type ConnState = 'checking' | 'ready' | 'unconfigured' | 'unreachable';

/**
 * Shown when connected mode is intended but the backend is missing or unavailable.
 * The app never silently falls back to demo mode — this is the honest failure UX,
 * with a Retry that re-checks the connection.
 */
export function ConnectionScreen({
  state, detail, onRetry, retrying,
}: { state: 'unconfigured' | 'unreachable'; detail?: string; onRetry: () => void; retrying?: boolean }) {
  const insets = useSafeAreaInsets();
  const unconfigured = state === 'unconfigured';
  // Build-setup wording is for developers only. A release binary can't reach this
  // state (EAS production builds fail without the config, see app.config.js), but if
  // it ever did, users see a plain message rather than setup instructions.
  const devSetup = unconfigured && __DEV__;

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.center}>
        <View style={{ marginBottom: space.sm }}><BrandMark size={56} /></View>
        <View style={styles.icon}>
          <Ionicons name={unconfigured ? 'construct-outline' : 'cloud-offline-outline'} size={30} color={colors.forest700} />
        </View>
        <Text style={styles.title}>{devSetup ? 'Setup needed' : unconfigured ? 'ToGo is unavailable' : 'Can’t reach ToGo'}</Text>
        <Text style={styles.body}>
          {unconfigured && !devSetup
            ? 'ToGo can’t start right now. Please update the app from the store, or try again later.'
            : unconfigured
            ? 'ToGo isn’t connected to its booking service yet. The app needs a Supabase project URL and publishable key configured at build time before departures, bookings and check-ins can load.'
            : 'ToGo is configured but the booking service didn’t respond. Check your connection and try again — your data is safe on the server.'}
        </Text>
        {detail && (__DEV__ || !unconfigured) ? <Text style={styles.detail} numberOfLines={3}>{detail}</Text> : null}
      </View>

      <View style={styles.actions}>
        <PrimaryButton title={retrying ? 'Checking…' : 'Try again'} onPress={onRetry} loading={retrying} />
        {devSetup && (
          <Text style={styles.note}>
            This is set once, at build time. After adding the configuration the app must be rebuilt or restarted.
          </Text>
        )}
      </View>
    </View>
  );
}

/** Full-screen spinner while the connection is being checked. */
export function ConnectionChecking() {
  return (
    <View style={styles.checking}>
      <ActivityIndicator color={colors.forest700} />
      <Text style={styles.checkingText}>Connecting…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: SCREEN, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: font.h1, fontWeight: '700', color: colors.ink, marginTop: space.sm },
  body: { fontSize: font.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 23, paddingHorizontal: space.sm },
  detail: { fontSize: font.tiny, color: colors.muted, textAlign: 'center', marginTop: space.xs },
  actions: { gap: space.sm },
  note: { fontSize: font.tiny, color: colors.muted, textAlign: 'center', lineHeight: 17 },
  checking: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: space.md },
  checkingText: { color: colors.muted, fontSize: font.small },
});
