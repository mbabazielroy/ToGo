import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavBar, Group, Separator, Loading, ErrorRow, EmptyState, SectionHeading } from '../../src/components/ui';
import { useAdapter, useAppMode, useDataEpoch } from '../../src/data/AdapterProvider';
import { useAsync } from '../../src/hooks/useAsync';
import { colors, radius, space, font, SCREEN, control } from '../../src/theme';
import type { StaffView } from '@shared/data/adapter';

type StaffRoute = '/staff/driver' | '/staff/conductor' | '/staff/attendant';
const ROLE_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; route: StaffRoute }> = {
  driver: { label: 'Drivers', icon: 'bus-outline', route: '/staff/driver' },
  conductor: { label: 'Conductors', icon: 'ticket-outline', route: '/staff/conductor' },
  attendant: { label: 'Hub attendants', icon: 'location-outline', route: '/staff/attendant' },
};
const ORDER: ('driver' | 'conductor' | 'attendant')[] = ['driver', 'conductor', 'attendant'];

export default function StaffIndex() {
  const adapter = useAdapter();
  const mode = useAppMode();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const epoch = useDataEpoch();
  const staff = useAsync(() => adapter.listStaff(), [epoch]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NavBar title="Staff workspace" onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: insets.bottom + space.xxl }}>
        {mode === 'demo' ? (
          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={16} color={colors.forest700} />
            <Text style={styles.noteText}>Preview personas — choose a fictional staff member to see their workspace. Selecting a persona grants no real permission; it only filters simulated data on this device.</Text>
          </View>
        ) : (
          <View style={styles.note}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.forest700} />
            <Text style={styles.noteText}>Connected mode shows only the workspaces your account is assigned to. Staff assignment is resolved on the server from verified records.</Text>
          </View>
        )}

        {staff.loading && <Loading />}
        {staff.error && <ErrorRow message={staff.error} onRetry={staff.reload} />}
        {!staff.loading && !staff.error && (staff.data?.length ?? 0) === 0 && (
          <EmptyState title={mode === 'connected' ? 'No staff workspaces' : 'No staff to preview'}>
            {mode === 'connected'
              ? 'Your account has no verified staff assignments yet, or connected staff assignment is not available in this build.'
              : 'Reset the preview to reseed staff.'}
          </EmptyState>
        )}

        {ORDER.map((role) => {
          const list = (staff.data ?? []).filter((s) => s.role === role);
          if (list.length === 0) return null;
          const meta = ROLE_META[role];
          return (
            <View key={role}>
              <SectionHeading title={meta.label} />
              <Group>
                {list.map((s, i) => (
                  <View key={s.id}>
                    {i > 0 && <Separator inset={SCREEN + 32} />}
                    <PersonaRow staff={s} icon={meta.icon} onPress={() => router.push({ pathname: meta.route, params: { staff: s.id } })} />
                  </View>
                ))}
              </Group>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function PersonaRow({ staff, icon, onPress }: { staff: StaffView; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  const sub = staff.role === 'attendant'
    ? staff.assignedHubName ?? 'No hub assigned'
    : `${staff.operatorName ?? 'Operator'} · ${staff.assignedTripCount} trip${staff.assignedTripCount === 1 ? '' : 's'} today`;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${staff.name}, ${staff.role}`} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.forest50 }]}>
      <View style={styles.avatar}><Ionicons name={icon} size={18} color={colors.forest700} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{staff.name}</Text>
        <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.forest50, borderRadius: radius.md, padding: space.md, marginTop: space.sm },
  noteText: { flex: 1, color: colors.forest800, fontSize: font.small, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.md, minHeight: control.height + 6, paddingVertical: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.forest100, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: font.body, fontWeight: '600', color: colors.ink },
  sub: { fontSize: font.small, color: colors.muted, marginTop: 1 },
});
