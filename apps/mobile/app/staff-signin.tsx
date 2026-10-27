import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { APP_VARIANT } from '@/env';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavBar, Group, Separator, SectionHeading, PrimaryButton, Loading, EmptyState, Banner, ListRow } from '@/components/ui';
import { useAppMode } from '@/data/AdapterProvider';
import { useAuth } from '@/auth/AuthProvider';
import { useSession, homeFor, ROLE_LABEL, type Identity, type Role } from '@/session/SessionProvider';
import { haptics } from '@/lib/feedback';
import { colors, space, font, SCREEN } from '@/theme';

const GROUPS: { role: Role; title: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { role: 'driver', title: 'Drivers', icon: 'bus', color: '#1f5fd1' },
  { role: 'conductor', title: 'Conductors', icon: 'ticket', color: '#0c7a43' },
  { role: 'attendant', title: 'Hub attendants', icon: 'location', color: '#c2410c' },
  { role: 'admin', title: 'Operations', icon: 'grid', color: '#334155' },
];

/** Entry to the crew and operations spaces. Preview: pick a fictional persona.
 *  Connected: sign in, then choose among the workspaces your account is verified for. */
export default function StaffSignIn() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mode = useAppMode();
  const { session } = useAuth();
  const { available, availableLoading, signInAs } = useSession();

  async function enter(identity: Identity) {
    haptics.success();
    await signInAs(identity);
    router.replace(homeFor(identity));
  }

  const needsAuth = mode === 'connected' && !session;
  if (APP_VARIANT === 'passenger') return <Redirect href="/welcome" />;
  const standalone = APP_VARIANT === 'staff';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {standalone ? (
        <View style={styles.brandRow}>
          <View style={styles.logo}><Text style={styles.logoText}>T</Text></View>
          <Text style={styles.brand}>ToGo Staff</Text>
        </View>
      ) : (
        <NavBar title="" onBack={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
      )}
      <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: insets.bottom + space.xxl }}>
        <Text style={styles.title} accessibilityRole="header">{standalone ? 'Sign in to your shift' : 'Staff workspace'}</Text>
        <Text style={styles.lead}>
          Drivers, conductors and hub attendants run today's trips here. Operations admins manage departures, crew and the network.
        </Text>

        {mode === 'demo' && (
          <View style={{ marginTop: space.lg }}>
            <Banner tone="info" title="Preview personas">
              Choose a fictional team member to explore their workspace. This only filters simulated data on this device — it grants no real access.
            </Banner>
          </View>
        )}

        {needsAuth ? (
          <View style={{ marginTop: space.xl, gap: space.md }}>
            <EmptyState title="Sign in with your staff account">
              Use the email your operator registered for you. Workspaces appear once your account is assigned to a trip, hub or the operations team.
            </EmptyState>
            <PrimaryButton title="Sign in" icon="log-in-outline" onPress={() => router.push('/auth?next=/staff-signin&staff=1')} />
          </View>
        ) : availableLoading ? (
          <Loading />
        ) : available.length === 0 ? (
          <View style={{ marginTop: space.xl }}>
            <EmptyState title="No staff access on this account">
              Your account isn't assigned to any trip, hub or the operations team yet. Ask your operator to add you, then pull to refresh.
            </EmptyState>
          </View>
        ) : (
          GROUPS.map((g) => {
            const people = available.filter((a) => a.role === g.role);
            if (people.length === 0) return null;
            return (
              <View key={g.role}>
                <SectionHeading title={g.title} />
                <Group>
                  {people.map((p, i) => (
                    <View key={`${p.role}:${p.staffId ?? 'x'}`}>
                      {i > 0 && <Separator inset={SCREEN + 44} />}
                      <ListRow icon={g.icon} iconColor={g.color} title={p.name} subtitle={[ROLE_LABEL[p.role], p.detail].filter(Boolean).join(' · ')} onPress={() => enter(p)} />
                    </View>
                  ))}
                </Group>
              </View>
            );
          })
        )}

        <Text style={styles.foot}>{standalone ? 'Travelling? Use the ToGo passenger app.' : 'Travelling instead? Go back and choose “Get started”.'}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.6 },
  lead: { fontSize: font.body, color: colors.inkSoft, marginTop: space.sm, lineHeight: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, paddingHorizontal: SCREEN },
  logo: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.forest900, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.live, fontWeight: '900', fontSize: 16 },
  brand: { color: colors.ink, fontWeight: '900', fontSize: 20, letterSpacing: -0.3 },
  foot: { textAlign: 'center', color: colors.muted, fontSize: font.tiny, marginTop: space.xl },
});
