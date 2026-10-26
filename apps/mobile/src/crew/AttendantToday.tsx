import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Group, PrimaryButton, Loading, ErrorRow, EmptyState, Separator, SectionHeading, LineBadge, Banner } from '@/components/ui';
import { BookingStatusPill } from '@/components/StatusPill';
import { useAdapter, useDataEpoch } from '@/data/AdapterProvider';
import { useAsync, humanError } from '@/hooks/useAsync';
import { useNow, leadTime } from '@/hooks/useNow';
import { useToast } from '@/components/ToastProvider';
import { haptics } from '@/lib/feedback';
import { lineFor } from '@/lib/lines';
import { colors, radius, space, font, SCREEN, control } from '@/theme';
import { formatTime, kampalaToday } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import { hubCounts } from '@/staff/counts';
import type { HubExpectedRow, TripView } from '@shared/data/adapter';
import { CrewHeader, HeaderStat } from './CrewHeader';

export interface HubBus { trip: TripView; rows: HubExpectedRow[]; pickupTime: string }

/** Everything an attendant needs about their hub: buses due, who's expected, incidents. */
export function useHubBoard(staffId: string, tick: number) {
  const adapter = useAdapter();
  const epoch = useDataEpoch();
  return useAsync(async () => {
    const hubId = await adapter.attendantHubId(staffId);
    if (!hubId) return null;
    const hubs = await adapter.listHubs();
    const hub = hubs.find((h) => h.id === hubId) ?? null;
    const direction = hub?.city === 'Mbarara' ? 'MBR_KLA' : 'KLA_MBR';
    const [expected, incidents, scheduled] = await Promise.all([
      adapter.getHubExpected(hubId),
      adapter.hubIncidents(hubId),
      // Every bus due at this hub today, booked or not.
      adapter.searchTrips({ direction, date: kampalaToday(), hubId }),
    ]);
    const known = new Set(scheduled.map((t) => t.id));
    const extraIds = [...new Set(expected.map((r) => r.tripId))].filter((id) => !known.has(id));
    const extra = (await Promise.all(extraIds.map((id) => adapter.getTrip(id)))).filter((t): t is TripView => !!t);
    const trips = [...scheduled, ...extra];
    const buses: HubBus[] = trips
      .map((t) => ({ trip: t, rows: expected.filter((r) => r.tripId === t.id), pickupTime: t.stops.find((s) => s.hubId === hubId)?.pickupTime ?? t.originDeparture }))
      .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));
    return { hubId, hub, buses, incidents, totals: hubCounts(expected) };
  }, [staffId, tick, epoch]);
}

export function AttendantToday({ staffId }: { staffId: string }) {
  const adapter = useAdapter();
  const toast = useToast();
  const now = useNow(30000);
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [openTrip, setOpenTrip] = useState<string | null>(null);
  const data = useHubBoard(staffId, tick);
  const d = data.data;

  async function checkIn(reference: string) {
    const r = reference.trim().toUpperCase();
    if (!r || busy) return;
    setBusy(true);
    try {
      const b = await adapter.checkInByReference(r);
      haptics.success();
      toast(`${b.passengerName} checked in · ${b.seats} seat${b.seats === 1 ? '' : 's'}`, 'ok');
      setRef(''); setTick((n) => n + 1);
    } catch (e) { haptics.warning(); toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }

  const nextBus = d?.buses.find((b) => b.trip.status !== 'completed' && b.trip.status !== 'cancelled'
    && !b.trip.stops.find((st) => st.hubId === d.hubId)?.reached);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <CrewHeader title={d?.hub?.name}>
        {d && (
          <View style={styles.headerStats}>
            <HeaderStat label="Expected today" value={d.totals.expected} />
            <HeaderStat label="Checked in" value={d.totals.checkedIn} tone={colors.live} />
            <HeaderStat label="Buses" value={d.buses.length} />
          </View>
        )}
      </CrewHeader>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SCREEN, paddingBottom: space.xxl, gap: space.md }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setTick((n) => n + 1)} tintColor={colors.forest700} />}>
        {data.loading && !data.data && <Loading />}
        {data.error && <ErrorRow message={data.error} onRetry={() => setTick((n) => n + 1)} />}
        {!data.loading && !d && <EmptyState title="No hub assigned">Operations hasn't assigned you to a hub yet.</EmptyState>}

        {d && (
          <>
            <Group style={{ padding: space.md }}>
              <Text style={styles.label}>Check in a passenger by booking reference</Text>
              <View style={styles.codeRow}>
                <TextInput style={styles.codeInput} value={ref} onChangeText={setRef} placeholder="TG-0000" placeholderTextColor={colors.faint}
                  autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Booking reference" returnKeyType="done" onSubmitEditing={() => checkIn(ref)} />
                <View style={{ width: 116 }}><PrimaryButton title="Check in" onPress={() => checkIn(ref)} loading={busy} disabled={!ref.trim()} /></View>
              </View>
            </Group>

            {nextBus && (
              <View style={styles.nextBus}>
                <Text style={styles.nextKicker}>Next bus</Text>
                <View style={styles.nextRow}>
                  <LineBadge code={lineFor(nextBus.trip.operatorId, nextBus.trip.operatorName).code} color={lineFor(nextBus.trip.operatorId, nextBus.trip.operatorName).color} />
                  <Text style={styles.nextTitle} numberOfLines={1}>To {DIRECTION_CITIES[nextBus.trip.direction].destination}</Text>
                  <Text style={styles.nextTime}>{formatTime(nextBus.pickupTime)}</Text>
                </View>
                <Text style={styles.nextMeta}>
                  {nextBus.trip.operatorName} · {leadTime(nextBus.pickupTime, now)}{nextBus.trip.delayMinutes > 0 ? ` · running ${nextBus.trip.delayMinutes} min late` : ''}
                </Text>
              </View>
            )}

            <SectionHeading title="Buses at this hub" />
            {d.buses.length === 0 && <EmptyState title="No buses expected">Reservations for this hub appear here.</EmptyState>}
            {d.buses.map((b) => {
              const c = hubCounts(b.rows);
              const line = lineFor(b.trip.operatorId, b.trip.operatorName);
              const open = openTrip === b.trip.id;
              const waiting = b.rows.filter((r) => r.status === 'reserved');
              return (
                <Group key={b.trip.id}>
                  <Pressable onPress={() => setOpenTrip(open ? null : b.trip.id)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.busHead}>
                    <LineBadge code={line.code} color={line.color} size="sm" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.busRoute}>{formatTime(b.pickupTime)} · to {DIRECTION_CITIES[b.trip.direction].destination}</Text>
                      <Text style={styles.busMeta}>{b.trip.operatorName}{b.trip.delayMinutes > 0 ? ` · +${b.trip.delayMinutes} min` : ''}{b.trip.status === 'cancelled' ? ' · cancelled' : b.trip.status === 'completed' ? ' · completed' : b.trip.stops.find((st) => st.hubId === d.hubId)?.reached ? ' · departed' : ''}</Text>
                    </View>
                    <Text style={styles.busProgress}>{c.checkedIn}/{c.expected}</Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
                  </Pressable>
                  {open && b.rows.map((r) => (
                    <View key={r.bookingId}>
                      <Separator inset={space.md} />
                      <View style={styles.paxRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.paxName} numberOfLines={1}>{r.passengerName}</Text>
                          <Text style={styles.paxMeta}>{r.reference} · {r.seats} seat{r.seats === 1 ? '' : 's'}</Text>
                        </View>
                        {r.status === 'reserved' ? (
                          <Pressable onPress={() => checkIn(r.reference)} accessibilityRole="button" accessibilityLabel={`Check in ${r.passengerName}`} style={styles.inBtn}>
                            <Text style={styles.inBtnText}>Check in</Text>
                          </Pressable>
                        ) : <BookingStatusPill status={r.status} />}
                      </View>
                    </View>
                  ))}
                  {!open && waiting.length > 0 && <Text style={styles.waitHint}>{waiting.length} not checked in yet · tap to see</Text>}
                  {open && b.rows.length === 0 && <Text style={[styles.waitHint, { color: colors.muted, marginTop: 0 }]}>No reservations from this hub yet.</Text>}
                </Group>
              );
            })}

            {d.incidents.length > 0 && (
              <>
                <SectionHeading title="Needs follow-up" />
                <Banner tone="warn">Checked-in passengers the bus left without. Operations will contact them — help if they come back to the hub.</Banner>
                <Group>
                  {d.incidents.map((r, i) => (
                    <View key={r.bookingId}>
                      {i > 0 && <Separator inset={space.md} />}
                      <View style={styles.paxRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.paxName} numberOfLines={1}>{r.passengerName}</Text>
                          <Text style={styles.paxMeta}>{r.reference} · {r.seats} seat{r.seats === 1 ? '' : 's'} · {formatTime(r.pickupTime)}</Text>
                        </View>
                        <BookingStatusPill status={r.status} />
                      </View>
                    </View>
                  ))}
                </Group>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerStats: { flexDirection: 'row', gap: space.md },
  label: { fontSize: font.tiny, color: colors.muted, fontWeight: '600', marginBottom: space.sm },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  codeInput: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, minHeight: control.height, fontSize: font.title, fontWeight: '700', color: colors.ink, letterSpacing: 1 },
  nextBus: { backgroundColor: colors.surface, borderRadius: radius.xxl, padding: space.lg, gap: 4 },
  nextKicker: { fontSize: font.tiny, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextTitle: { flex: 1, fontSize: font.h2, fontWeight: '800', color: colors.ink },
  nextTime: { fontSize: 26, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  nextMeta: { fontSize: font.small, color: colors.forest700, fontWeight: '600' },
  busHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: space.md, minHeight: 60 },
  busRoute: { fontSize: font.body, fontWeight: '700', color: colors.ink },
  busMeta: { fontSize: font.tiny, color: colors.muted, marginTop: 1 },
  busProgress: { fontSize: font.body, fontWeight: '800', color: colors.forest700, fontVariant: ['tabular-nums'] },
  waitHint: { fontSize: font.tiny, color: colors.amber800, paddingHorizontal: space.md, paddingBottom: space.md, marginTop: -6 },
  paxRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10, paddingHorizontal: space.md },
  paxName: { fontSize: font.body, fontWeight: '600', color: colors.ink },
  paxMeta: { fontSize: font.small, color: colors.muted, marginTop: 1 },
  inBtn: { backgroundColor: colors.forest700, borderRadius: 999, paddingHorizontal: 14, height: 34, justifyContent: 'center' },
  inBtnText: { color: colors.white, fontSize: font.tiny, fontWeight: '800' },
});
