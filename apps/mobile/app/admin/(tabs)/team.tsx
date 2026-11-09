import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Group, Separator, SectionHeading, Loading, ErrorRow, PageHeader, Avatar, Banner, ListRow } from '@/components/ui';
import { useAdapter, useAppMode, useDataEpoch } from '@/data/AdapterProvider';
import { homeFor, useSession } from '@/session/SessionProvider';
import { useAsync } from '@/hooks/useAsync';
import { space, font, SCREEN, radius, control, makeStyles } from '@/theme';
import { ask } from '@/lib/dialog';
import { AppearanceSetting } from '@/appearance/AppearanceSetting';

const GROUPS = [
  { role: 'driver', title: 'Drivers', color: '#1f5fd1' },
  { role: 'conductor', title: 'Conductors', color: '#0c7a43' },
  { role: 'attendant', title: 'Hub attendants', color: '#c2410c' },
] as const;

/** Crew directory with today's load, plus the admin's own account controls. */
export default function AdminTeam() {
  const styles = useStyles();
  const adapter = useAdapter();
  const epoch = useDataEpoch();
  const mode = useAppMode();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut, identity } = useSession();
  const staff = useAsync(() => adapter.listStaff(), [epoch]);

  function confirmSignOut() {
    ask('Sign out of operations?', 'You’ll return to the welcome screen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace(homeFor(null)); } },
    ]);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: space.xxl }}>
        <PageHeader title="Team" subtitle={identity?.name} />
        {mode === 'connected' && (
          <Banner tone="info" title="Crew directory">Crew accounts are managed in the web operator console. Here you see the workspaces linked to your account.</Banner>
        )}
        {staff.loading && <Loading />}
        {staff.error && <ErrorRow message={staff.error} onRetry={staff.reload} />}
        {GROUPS.map((g) => {
          const people = (staff.data ?? []).filter((s) => s.role === g.role);
          if (!people.length) return null;
          return (
            <View key={g.role}>
              <SectionHeading title={`${g.title} · ${people.length}`} />
              <Group>
                {people.map((p, i) => (
                  <View key={p.id}>
                    {i > 0 && <Separator inset={SCREEN + 52} />}
                    <View style={styles.row}>
                      <Avatar name={p.name} color={g.color} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{p.name}</Text>
                        <Text style={styles.meta}>
                          {g.role === 'attendant' ? (p.assignedHubName ?? 'No hub') : `${p.operatorName ?? 'Operator'} · ${p.assignedTripCount} trip${p.assignedTripCount === 1 ? '' : 's'} today`}
                        </Text>
                        {p.phone ? <Text style={styles.phone}>{p.phone}</Text> : null}
                      </View>
                    </View>
                  </View>
                ))}
              </Group>
            </View>
          );
        })}

        {mode === 'demo' && (
          <>
            <SectionHeading title="Preview" />
            <Group>
              <ListRow icon="swap-horizontal" title="See what crew see" subtitle="Sign out and open the staff workspace as any persona" onPress={() => router.push('/staff-signin')} />
            </Group>
          </>
        )}

        <AppearanceSetting />

        <Pressable onPress={confirmSignOut} accessibilityRole="button" style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: SCREEN, paddingVertical: space.md },
  name: { fontSize: font.body, fontWeight: '700', color: colors.ink },
  meta: { fontSize: font.tiny, color: colors.muted, marginTop: 1 },
  phone: { fontSize: font.tiny, color: colors.inkSoft, fontVariant: ['tabular-nums'], marginTop: 1 },
  signOut: { backgroundColor: colors.surface, borderRadius: radius.lg, minHeight: control.height, alignItems: 'center', justifyContent: 'center', marginTop: space.xl },
  signOutText: { color: colors.red700, fontWeight: '600', fontSize: font.body },
}));
