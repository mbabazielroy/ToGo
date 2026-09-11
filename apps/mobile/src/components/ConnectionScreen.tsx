import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from './ui';
import { colors, radius, space, font, SCREEN } from '../theme';

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

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.center}>
        <View style={styles.logo}><Text style={styles.logoText}>T</Text></View>
        <View style={styles.icon}>
          <Ionicons name={unconfigured ? 'construct-outline' : 'cloud-offline-outline'} size={30} color={colors.forest700} />
        </View>
        <Text style={styles.title}>{unconfigured ? 'Setup needed' : 'Can’t reach ToGo'}</Text>
        <Text style={styles.body}>
          {unconfigured
            ? 'ToGo isn’t connected to its booking service yet. The app needs a Supabase project URL and publishable key configured at build time before departures, bookings and check-ins can load.'
            : 'ToGo is configured but the booking service didn’t respond. Check your connection and try again — your data is safe on the server.'}
        </Text>
        {detail ? <Text style={styles.detail} numberOfLines={3}>{detail}</Text> : null}
      </View>

      <View style={styles.actions}>
        <PrimaryButton title={retrying ? 'Checking…' : 'Try again'} onPress={onRetry} loading={retrying} />
        {unconfigured && (
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
  logo: { width: 40, height: 40, borderRadius: 11, backgroundColor: colors.forest700, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  logoText: { color: colors.white, fontWeight: '800', fontSize: 22 },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: font.h1, fontWeight: '700', color: colors.ink, marginTop: space.sm },
  body: { fontSize: font.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 23, paddingHorizontal: space.sm },
  detail: { fontSize: font.tiny, color: colors.muted, textAlign: 'center', marginTop: space.xs },
  actions: { gap: space.sm },
  note: { fontSize: font.tiny, color: colors.muted, textAlign: 'center', lineHeight: 17 },
  checking: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: space.md },
  checkingText: { color: colors.muted, fontSize: font.small },
});
