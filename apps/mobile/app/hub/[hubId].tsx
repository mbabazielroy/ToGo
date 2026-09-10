import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Muted, PrimaryButton, Loading, ErrorRow, EmptyState, Separator } from '../../src/components/ui';
import { DepartureRow } from '../../src/components/DepartureRow';
import { useAdapter, useAppMode, useDataEpoch } from '../../src/data/AdapterProvider';
import { useSearch } from '../../src/state/search';
import { useAsync } from '../../src/hooks/useAsync';
import { haptics } from '../../src/lib/feedback';
import { colors, radius, space, font, SCREEN, control } from '../../src/theme';
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
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.topTitle}>Pickup hub</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: SCREEN, paddingTop: space.sm, paddingBottom: space.xxl * 2, gap: space.lg }}>
        {hubs.loading && <Loading />}
        {hubs.error && <ErrorRow message={hubs.error} onRetry={hubs.reload} />}
        {!hubs.loading && !hub && <EmptyState title="Hub not found">It may have been removed. Go back and pick another hub.</EmptyState>}

        {hub && (
          <>
            <View>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{hub.name}</Text>
                {mode === 'demo' && <View style={styles.demoChip}><Text style={styles.demoChipText}>Demo location</Text></View>}
              </View>
              <Text style={styles.addr}>{hub.area}</Text>
              {hub.openingHours ? <Text style={styles.hours}>{hub.openingHours}</Text> : null}
            </View>

            {hub.arrivalInstructions ? (
              <View style={{ gap: space.xs }}>
                <Text style={styles.section}>Where to wait</Text>
                <Text style={styles.instr}>{hub.arrivalInstructions}</Text>
                {mode === 'demo' && <Text style={styles.illus}>Illustrative boarding instructions for the demo.</Text>}
              </View>
            ) : null}

            {facilities.length > 0 && (
              <View style={{ gap: space.sm }}>
                <Text style={styles.section}>Facilities</Text>
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
              </View>
            )}

            <View style={{ gap: space.sm }}>
              <Text style={styles.section}>Upcoming departures today</Text>
              {trips.loading && <Loading />}
              {trips.error && <ErrorRow message={trips.error} onRetry={trips.reload} />}
              {trips.data && trips.data.length === 0 && (
                <Muted style={{ fontSize: font.small }}>No more departures from this hub today.</Muted>
              )}
              {trips.data && trips.data.length > 0 && (
                <View style={styles.list}>
                  {trips.data.map((t, i) => {
                    const j = tripJourney(t, hub.id);
                    return (
                      <View key={t.id}>
                        {i > 0 && <Separator />}
                        <DepartureRow trip={t} pickup={j.pickup} showDestination onPress={() => router.push(`/book/${t.id}?hub=${hub.id}&pax=1`)} />
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingVertical: space.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: font.title, fontWeight: '800', color: colors.ink },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  name: { fontSize: font.h1, fontWeight: '900', color: colors.ink, flexShrink: 1 },
  demoChip: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  demoChipText: { color: colors.inkSoft, fontSize: font.tiny, fontWeight: '700' },
  addr: { color: colors.inkSoft, fontSize: font.body, marginTop: 4 },
  hours: { color: colors.muted, fontSize: font.small, marginTop: 2 },
  section: { fontSize: font.small, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.muted },
  instr: { color: colors.ink, fontSize: font.body, lineHeight: 22 },
  illus: { color: colors.muted, fontSize: font.tiny },
  facGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fac: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, height: control.small },
  facText: { color: colors.inkSoft, fontSize: font.small, fontWeight: '600' },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, paddingHorizontal: space.md },
  footer: { backgroundColor: colors.surface, paddingHorizontal: SCREEN, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
});
