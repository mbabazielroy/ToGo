import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavBar, Group, Muted, GhostButton, Loading, ErrorRow, EmptyState, Separator, SectionHeading } from '../../src/components/ui';
import { BookingStatusPill } from '../../src/components/StatusPill';
import { useAdapter } from '../../src/data/AdapterProvider';
import { useAsync, humanError } from '../../src/hooks/useAsync';
import { useToast } from '../../src/components/ToastProvider';
import { haptics } from '../../src/lib/feedback';
import { colors, radius, space, font, SCREEN, control } from '../../src/theme';
import { formatTime } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import { hubCounts } from '../../src/staff/counts';
import type { HubExpectedRow, TripView } from '@shared/data/adapter';

interface Bus { trip: TripView; rows: HubExpectedRow[] }

export default function AttendantWorkspace() {
  const { staff } = useLocalSearchParams<{ staff: string }>();
  const adapter = useAdapter();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const data = useAsync(async () => {
    const hubId = await adapter.attendantHubId(String(staff));
    if (!hubId) return null;
    const hubs = await adapter.listHubs();
    const hub = hubs.find((h) => h.id === hubId) ?? null;
    const [expected, incidents] = await Promise.all([adapter.getHubExpected(hubId), adapter.hubIncidents(hubId)]);
    const tripIds = [...new Set(expected.map((r) => r.tripId))];
    const trips = (await Promise.all(tripIds.map((id) => adapter.getTrip(id)))).filter((t): t is TripView => !!t);
    const buses: Bus[] = trips
      .map((t) => ({ trip: t, rows: expected.filter((r) => r.tripId === t.id) }))
      .sort((a, b) => a.trip.originDeparture.localeCompare(b.trip.originDeparture));
    return { hubId, hub, buses, incidents, totals: hubCounts(expected) };
  }, [staff, tick]);

  async function checkIn() {
    const r = ref.trim();
    if (!r || busy) return;
    setBusy(true);
    try {
      const b = await adapter.checkInByReference(r);
      haptics.success();
      toast(`Checked in ${b.passengerName} (${b.seats})`, 'ok');
      setRef(''); setTick((n) => n + 1);
    } catch (e) { haptics.warning(); toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }

  const d = data.data;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NavBar title="Hub attendant" onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        {data.loading && <Loading />}
        {data.error && <ErrorRow message={data.error} onRetry={() => setTick((n) => n + 1)} />}
        {!data.loading && !d && <EmptyState title="No hub assigned">This attendant has no hub assignment.</EmptyState>}

        {d && (
          <>
            <View style={styles.hero}>
              <Text style={styles.name}>{d.hub?.name ?? 'Hub'}</Text>
              <Text style={styles.sub}>{d.hub?.area}</Text>
            </View>

            <Group style={{ paddingHorizontal: space.lg }}>
              <View style={styles.countsRow}>
                <Count label="Expected" value={d.totals.expected} />
                <Count label="Checked in" value={d.totals.checkedIn} tone={colors.forest700} />
              </View>
              <Muted style={{ fontSize: font.tiny }}>Passengers (seats) across today’s buses at this hub.</Muted>
            </Group>

            {/* Check-in by reference */}
            <SectionHeading title="Check in a passenger" />
            <Group style={{ padding: space.lg, gap: space.sm }}>
              <View style={styles.codeRow}>
                <TextInput
                  style={styles.codeInput}
                  value={ref}
                  onChangeText={setRef}
                  placeholder="Booking reference (e.g. TG-4F2A)"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  accessibilityLabel="Booking reference"
                />
                <GhostButton title="Check in" onPress={checkIn} />
              </View>
            </Group>

            <SectionHeading title="Upcoming buses" />
            {d.buses.length === 0 && (
              <Group style={{ padding: space.lg }}><Muted style={{ fontSize: font.small }}>No buses expected at this hub right now.</Muted></Group>
            )}
            {d.buses.map((b) => {
              const cities = DIRECTION_CITIES[b.trip.direction];
              const c = hubCounts(b.rows);
              return (
                <View key={b.trip.id} style={{ marginBottom: space.md }}>
                  <View style={styles.busHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.busRoute}>{cities.origin} → {cities.destination}</Text>
                      <Text style={styles.busMeta}>{b.trip.operatorName} · pickup {formatTime(b.rows[0]?.pickupTime ?? b.trip.originDeparture)}{b.trip.delayMinutes > 0 ? ` · delayed +${b.trip.delayMinutes}m` : ''}</Text>
                    </View>
                    <Text style={styles.busProgress}>{c.checkedIn}/{c.expected}</Text>
                  </View>
                  <Group style={{ paddingHorizontal: space.md }}>
                    {b.rows.map((r, i) => (
                      <View key={r.bookingId}>
                        {i > 0 && <Separator />}
                        <View style={styles.paxRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.paxName} numberOfLines={1}>{r.passengerName}</Text>
                            <Text style={styles.paxMeta}>{r.reference} · {r.seats} seat{r.seats === 1 ? '' : 's'}</Text>
                          </View>
                          <BookingStatusPill status={r.status} />
                        </View>
                      </View>
                    ))}
                  </Group>
                </View>
              );
            })}

            {d.incidents.length > 0 && (
              <>
                <SectionHeading title="Unresolved pickup incidents" />
                <Group style={{ paddingHorizontal: space.md }}>
                  {d.incidents.map((r, i) => (
                    <View key={r.bookingId}>
                      {i > 0 && <Separator />}
                      <View style={styles.paxRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.paxName} numberOfLines={1}>{r.passengerName}</Text>
                          <Text style={styles.paxMeta}>{r.reference} · {r.seats} seat{r.seats === 1 ? '' : 's'}</Text>
                        </View>
                        <BookingStatusPill status={r.status} />
                      </View>
                    </View>
                  ))}
                </Group>
                <Muted style={{ fontSize: font.tiny, marginTop: space.xs }}>Checked-in passengers who were not boarded — flagged for operations to investigate.</Muted>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <View style={styles.count}>
      <Text style={[styles.countValue, tone && { color: tone }]}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { marginTop: space.sm, marginBottom: space.xs },
  name: { fontSize: font.h1, fontWeight: '700', color: colors.ink },
  sub: { fontSize: font.body, color: colors.inkSoft, marginTop: 2 },
  countsRow: { flexDirection: 'row', paddingVertical: space.xs },
  count: { flex: 1, alignItems: 'center' },
  countValue: { fontSize: 28, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  countLabel: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  codeInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, minHeight: control.height, fontSize: font.body, color: colors.ink, backgroundColor: colors.surface },
  busHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs, paddingHorizontal: space.xs },
  busRoute: { fontSize: font.body, fontWeight: '700', color: colors.ink },
  busMeta: { fontSize: font.small, color: colors.muted, marginTop: 1 },
  busProgress: { fontSize: font.body, fontWeight: '700', color: colors.forest700, fontVariant: ['tabular-nums'] },
  paxRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 12 },
  paxName: { fontSize: font.body, fontWeight: '600', color: colors.ink },
  paxMeta: { fontSize: font.small, color: colors.muted, marginTop: 1 },
});
