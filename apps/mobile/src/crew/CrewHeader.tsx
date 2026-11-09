import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAppMode } from '@/data/AdapterProvider';
import { useSession, ROLE_LABEL } from '@/session/SessionProvider';
import { space, font, SCREEN, useColors, makeStyles } from '@/theme';

const ROLE_ICON = { driver: 'bus', conductor: 'ticket', attendant: 'location', admin: 'grid', passenger: 'person' } as const;

/** Dark header band that makes it obvious you're in a staff space, not the
 *  passenger app: who you are, your role and where you're working today. */
export function CrewHeader({ title, children }: { title?: string; children?: ReactNode }) {
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const mode = useAppMode();
  const { identity } = useSession();
  if (!identity) return null;
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.sm }]}>
      <StatusBar style="light" />
      <View style={styles.row}>
        <View style={styles.icon}><Ionicons name={ROLE_ICON[identity.role]} size={18} color={colors.forest900} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker} numberOfLines={1}>
            {ROLE_LABEL[identity.role]}{identity.detail ? ` · ${identity.detail}` : ''}
          </Text>
          <Text style={styles.name} numberOfLines={1}>{title ?? identity.name}</Text>
        </View>
        {mode === 'demo' && <View style={styles.tag}><Text style={styles.tagText}>Preview</Text></View>}
      </View>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { backgroundColor: colors.forest900, paddingHorizontal: SCREEN, paddingBottom: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.live, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: colors.onDarkSoft, fontSize: font.tiny, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { color: colors.white, fontSize: font.h2, fontWeight: '800', letterSpacing: -0.3, marginTop: 1 },
  tag: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { color: colors.white, fontSize: 12, fontWeight: '700' },
}));

/** Big white stat for use inside the dark header. */
export function HeaderStat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={{ color: tone ?? colors.white, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.6 }}>{value}</Text>
      <Text style={{ color: colors.onDarkSoft, fontSize: font.tiny, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
