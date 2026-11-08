import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Group, Separator, SectionHeading, ListRow, KeyValue, Banner } from '@/components/ui';
import { CrewHeader } from '@/crew/CrewHeader';
import { useAppMode } from '@/data/AdapterProvider';
import { useSession, ROLE_LABEL, homeFor, type Identity } from '@/session/SessionProvider';
import { colors, space, font, SCREEN, control, radius } from '@/theme';
import { ask } from '@/lib/dialog';
import { useAuth } from '@/auth/AuthProvider';
import { AccountSecurity } from '@/auth/AccountSecurity';

const ROLE_GUIDE: Record<string, string[]> = {
  driver: [
    'Start the trip when you leave the first hub — passengers see the bus is coming.',
    'Tap “Arrived at …” at each hub so waiting passengers and the attendant know.',
    'Report delays early. Use “Breakdown” only if the bus cannot continue.',
  ],
  conductor: [
    'Scan each boarding pass, check the name, then confirm. Scanning alone never boards anyone.',
    'Collect the fare shown on the confirmation card.',
    'Before leaving a hub, use “Leave …” so anyone checked in but missing is followed up.',
  ],
  attendant: [
    'Check passengers in by booking reference when they arrive at the hub.',
    'Watch “Next bus” for delays and tell waiting passengers.',
    'Help passengers listed under “Needs follow-up” if they return.',
  ],
};

export default function CrewProfile() {
  const router = useRouter();
  const mode = useAppMode();
  const { identity, available, signInAs, signOut } = useSession();
  const { session } = useAuth();
  if (!identity) return null;
  const others = available.filter((a) => !(a.role === identity.role && a.staffId === identity.staffId));

  function switchTo(next: Identity) {
    signInAs(next).then(() => router.replace(homeFor(next)));
  }
  function confirmSignOut() {
    ask('Sign out of the workspace?', 'You’ll return to the welcome screen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace(homeFor(null)); } },
    ]);
  }

  return (
    <View style={styles.root}>
      <CrewHeader />
      <ScrollView contentContainerStyle={{ padding: SCREEN, gap: space.md, paddingBottom: space.xxl }}>
        <Group style={{ paddingHorizontal: space.lg }}>
          <KeyValue label="Role" value={ROLE_LABEL[identity.role]} />
          <Separator />
          <KeyValue label={identity.role === 'attendant' ? 'Hub' : 'Operator'} value={identity.detail ?? '—'} />
          <Separator />
          <KeyValue label="Access" value={mode === 'demo' ? 'Preview persona' : 'Verified assignment'} />
        </Group>

        {ROLE_GUIDE[identity.role] && (
          <View>
            <SectionHeading title="How this works" />
            <Group style={{ padding: space.lg, gap: space.md }}>
              {ROLE_GUIDE[identity.role].map((line, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: space.sm }}>
                  <Text style={styles.num}>{i + 1}</Text>
                  <Text style={styles.guide}>{line}</Text>
                </View>
              ))}
            </Group>
          </View>
        )}

        {others.length > 0 && (
          <View>
            <SectionHeading title={mode === 'demo' ? 'Switch persona' : 'Your other workspaces'} />
            <Group>
              {others.slice(0, 8).map((o, i) => (
                <View key={`${o.role}:${o.staffId ?? 'x'}`}>
                  {i > 0 && <Separator inset={SCREEN} />}
                  <ListRow title={o.name} subtitle={[ROLE_LABEL[o.role], o.detail].filter(Boolean).join(' · ')} onPress={() => switchTo(o)} />
                </View>
              ))}
            </Group>
          </View>
        )}

        {mode === 'demo' && (
          <Banner tone="info" title="Preview workspace">Actions here change the simulated trips on this device. Passengers in the preview see them straight away.</Banner>
        )}

        {mode === 'connected' && session && <AccountSecurity name={identity.name} />}

        <View>
          <SectionHeading title="About" />
          <Group>
            <ListRow icon="shield-checkmark-outline" title="Privacy policy" onPress={() => router.push('/legal?doc=privacy')} />
            <Separator inset={SCREEN + 44} />
            <ListRow icon="document-text-outline" title="Terms of use" onPress={() => router.push('/legal?doc=terms')} />
          </Group>
        </View>

        <Pressable onPress={confirmSignOut} accessibilityRole="button" style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  num: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.forest100, color: colors.forest700, textAlign: 'center', lineHeight: 22, fontWeight: '800', fontSize: 12, overflow: 'hidden' },
  guide: { flex: 1, fontSize: font.small, color: colors.inkSoft, lineHeight: 20 },
  signOut: { backgroundColor: colors.surface, borderRadius: radius.lg, minHeight: control.height, alignItems: 'center', justifyContent: 'center' },
  signOutText: { color: colors.red700, fontWeight: '600', fontSize: font.body },
});
