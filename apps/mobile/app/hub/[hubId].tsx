import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavBar, Group, Muted, PrimaryButton, Loading, ErrorRow, EmptyState, Separator, SectionHeading } from '../../src/components/ui';
import { DepartureRow } from '../../src/components/DepartureRow';
import { useAdapter, useAppMode, useDataEpoch } from '../../src/data/AdapterProvider';
import { useSearch } from '../../src/state/search';
import { useAsync } from '../../src/hooks/useAsync';
import { haptics } from '../../src/lib/feedback';
import { colors, radius, space, font, SCREEN } from '../../src/theme';
import { kampalaToday } from '@shared/lib/time';
import { tripJourney } from '@shared/data/journey';
import type { DirectionCode } from '@shared/data/adapter';

const FACILITIES: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  shelter: { label: 'Covered shelter', icon: 'home-outline' },
  seating: { label: 'Seating', icon: 'browsers-outline' },
  toilets: { label: 'Toilets', icon: 'water-outline' },
  attendant: { label: 'Attendant', icon: 'person-outline' },
  water: { label: 'Drinking water', icon: 'cafe-outline' },
  lighting: { label: 'Lit at night', icon: 'bulb-outline' },
};

export default function HubDetail() {
  const { hubId } = useLocalSearchParams<{ hubId: string }>();
  const adapter = useAdapter();
  const mode = useAppMode();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const epoch = useDataEpoch();
  const { set } = useSearch();

  const hubs = useAsync(() => adapter.listHubs(), [epoch]);
  const hub = (hubs.data ?? []).find((h) => h.id === hubId);
  const direction: DirectionCode = hub?.city === 'Kampala' ? 'KLA_MBR' : 'MBR_KLA';
  const today = kampalaToday();

  const trips = useAsync(
    () => (hub ? adapter.searchTrips({ direction, date: today, hubId: hub.id }) : Promise.resolve([])),
    [hub?.id, epoch],
  );

  const facilities = useMemo(
    () => Object.entries(hub?.facilities ?? {}).filter(([, v]) => v).map(([k]) => k),
    [hub],
  );

  function choose() {
    if (!hub) return;
    haptics.select();
    set({ direction, date: today, hubId: hub.id });
    router.replace('/');
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NavBar title="Pickup hub" onBack={() => router.back()} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: space.xxl * 2 }}>
        {hubs.loading && <Loading />}
        {hubs.error && <ErrorRow message={hubs.error} onRetry={hubs.reload} />}
        {!hubs.loading && !hub && <EmptyState title="Hub not found">It may have been removed. Go back and pick another hub.</EmptyState>}

        {hub && (
          <>
            <View style={styles.hero}>
              <Text style={styles.name}>{hub.name}</Text>
              <Text style={styles.addr}>{hub.area}</Text>
              <View style={styles.metaRow}>
                {hub.openingHours ? <Text style={styles.hours}>{hub.openingHours}</Text> : null}
                {mode === 'demo' && <Text style={styles.demoTag}>Demo location</Text>}
              </View>
            </View>

            {hub.arrivalInstructions ? (
              <>
                <SectionHeading title="Where to wait" />
                <Group style={{ padding: space.lg }}>
                  <Text style={styles.instr}>{hub.arrivalInstructions}</Text>
                  {mode === 'demo' && <Text style={styles.illus}>Illustrative for the demo.</Text>}
                </Group>
              </>
            ) : null}

            {facilities.length > 0 && (
              <>
                <SectionHeading title="Facilities" />
                <View style={styles.facGrid}>
                  {facilities.map((k) => {
                    const f = FACILITIES[k] ?? { label: k, icon: 'checkmark-circle-outline' as const };
                    return (
                      <View key={k} style={styles.fac}>
                        <Ionicons name={f.icon} size={18} color={colors.forest700} />
                        <Text style={styles.facText}>{f.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            <SectionHeading title="Departures today" />
            {trips.loading && <Loading />}
            {trips.error && <ErrorRow message={trips.error} onRetry={trips.reload} />}
            {trips.data && trips.data.length === 0 && (
              <Group style={{ padding: space.lg }}><Muted style={{ fontSize: font.small }}>No more departures from this hub today.</Muted></Group>
            )}
            {trips.data && trips.data.length > 0 && (
              <Group style={{ paddingHorizontal: SCREEN }}>
                {trips.data.map((t, i) => {
                  const j = tripJourney(t, hub.id);
                  return (
                    <View key={t.id}>
                      {i > 0 && <Separator inset={76} />}
                      <DepartureRow trip={t} pickup={j.pickup} showDestination onPress={() => router.push(`/book/${t.id}?hub=${hub.id}&pax=1`)} />
                    </View>
                  );
                })}
              </Group>
            )}
          </>
        )}
      </ScrollView>

      {hub && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          <PrimaryButton title="Use this pickup hub" onPress={choose} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { paddingHorizontal: space.xs, paddingTop: space.sm },
  name: { fontSize: font.h1, fontWeight: '700', color: colors.ink },
  addr: { color: colors.inkSoft, fontSize: font.body, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 4, flexWrap: 'wrap' },
  hours: { color: colors.muted, fontSize: font.small },
  demoTag: { color: colors.muted, fontSize: font.small },
  instr: { color: colors.ink, fontSize: font.body, lineHeight: 22 },
  illus: { color: colors.muted, fontSize: font.tiny, marginTop: 6 },
  facGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fac: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 12, height: 40 },
  facText: { color: colors.inkSoft, fontSize: font.small },
  footer: { backgroundColor: colors.surface, paddingHorizontal: SCREEN, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
});
