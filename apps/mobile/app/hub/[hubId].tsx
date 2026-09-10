import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, H2, Muted, PrimaryButton, Loading, ErrorRow, EmptyState, Separator } from '../../src/components/ui';
import { DepartureRow } from '../../src/components/DepartureRow';
import { useAdapter, useDataEpoch } from '../../src/data/AdapterProvider';
import { useSearch } from '../../src/state/search';
import { useAsync } from '../../src/hooks/useAsync';
import { haptics } from '../../src/lib/feedback';
import { colors, radius, space, font, shadow } from '../../src/theme';
import { kampalaToday } from '@shared/lib/time';
import type { DirectionCode } from '@shared/data/adapter';

const FACILITIES: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  shelter: { label: 'Covered shelter', icon: 'home-outline' },
  seating: { label: 'Seating', icon: 'browsers-outline' },
  toilets: { label: 'Toilets', icon: 'water-outline' },
  attendant: { label: 'ToGo attendant', icon: 'person-outline' },
  water: { label: 'Drinking water', icon: 'cafe-outline' },
  lighting: { label: 'Lit at night', icon: 'bulb-outline' },
};

export default function HubDetail() {
  const { hubId } = useLocalSearchParams<{ hubId: string }>();
  const adapter = useAdapter();
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
          <Ionicons name="chevron-back" size={20} color={colors.forest700} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{hub?.name ?? 'Hub'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
          {hubs.loading && <Loading />}
          {hubs.error && <ErrorRow message={hubs.error} onRetry={hubs.reload} />}
          {!hubs.loading && !hub && <EmptyState title="Hub not found">It may have been removed. Go back and pick another hub.</EmptyState>}

          {hub && (
            <>
              <View style={styles.hero}>
                <View style={styles.pin}><Ionicons name="location" size={22} color={colors.forest700} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{hub.name}</Text>
                  <Text style={styles.city}>{hub.area} · {hub.city}</Text>
                  {hub.openingHours ? <Text style={styles.hours}>{hub.openingHours}</Text> : null}
                </View>
              </View>

              <View style={styles.demoNote}>
                <Ionicons name="information-circle-outline" size={15} color={colors.forest600} />
                <Text style={styles.demoNoteText}>Illustrative demo location — not an officially approved site. No map distance is shown because hub coordinates are not published in this pilot.</Text>
              </View>

              {hub.arrivalInstructions ? (
                <Card style={{ gap: 6 }}>
                  <H2>Where to wait</H2>
                  <Text style={styles.instr}>{hub.arrivalInstructions}</Text>
                </Card>
              ) : null}

              {facilities.length > 0 && (
                <Card style={{ gap: 10 }}>
                  <H2>Facilities</H2>
                  <View style={styles.facGrid}>
                    {facilities.map((k) => {
                      const f = FACILITIES[k] ?? { label: k, icon: 'checkmark-circle-outline' as const };
                      return (
                        <View key={k} style={styles.fac}>
                          <Ionicons name={f.icon} size={16} color={colors.forest700} />
                          <Text style={styles.facText}>{f.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </Card>
              )}

              <Card style={{ gap: space.sm }}>
                <H2>Upcoming departures today</H2>
                {trips.loading && <Loading />}
                {trips.error && <ErrorRow message={trips.error} onRetry={trips.reload} />}
                {trips.data && trips.data.length === 0 && (
                  <Muted style={{ fontSize: font.small }}>No more departures from this hub today. Try “Choose this hub” to browse other days.</Muted>
                )}
                {trips.data && trips.data.length > 0 && trips.data.map((t, i) => {
                  const stops = [...t.stops].sort((a, b) => a.stopOrder - b.stopOrder);
                  const pickup = stops.find((s) => s.hubId === hub.id) ?? stops[0];
                  return (
                    <View key={t.id}>
                      {i > 0 && <Separator inset={72} />}
                      <DepartureRow
                        trip={t}
                        pickup={pickup}
                        onPress={() => router.push(`/book/${t.id}?hub=${hub.id}&pax=1`)}
                      />
                    </View>
                  );
                })}
              </Card>
            </>
          )}
        </ScrollView>

        {hub && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
            <PrimaryButton title="Choose this hub" onPress={choose} />
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sand100 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingVertical: space.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: font.title, fontWeight: '800', color: colors.forest900 },
  hero: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  pin: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.forest100, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: font.h1, fontWeight: '900', color: colors.forest900 },
  city: { color: colors.inkSoft, fontSize: font.body, marginTop: 2 },
  hours: { color: colors.muted, fontSize: font.small, marginTop: 2 },
  demoNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.lime50, borderRadius: radius.md, padding: space.md },
  demoNoteText: { flex: 1, color: colors.forest700, fontSize: font.tiny, lineHeight: 15 },
  instr: { color: colors.ink, fontSize: font.body, lineHeight: 21 },
  facGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fac: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.forest50, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  facText: { color: colors.forest800, fontSize: font.small, fontWeight: '600' },
  footer: { backgroundColor: colors.white, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, ...shadow.sheet },
});
