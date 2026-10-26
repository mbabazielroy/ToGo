import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavBar, Group, Separator, SectionHeading, Loading, ErrorRow, StatTile, ListRow, KeyValue, Banner, LineBadge, PrimaryButton, EmptyState } from '@/components/ui';
import { TripStatusPill, BookingStatusPill } from '@/components/StatusPill';
import { SelectSheet } from '@/components/SelectSheet';
import { useAdapter, useAppMode, useDataEpoch } from '@/data/AdapterProvider';
import { useAsync, humanError } from '@/hooks/useAsync';
import { useToast } from '@/components/ToastProvider';
import { haptics } from '@/lib/feedback';
import { lineFor } from '@/lib/lines';
import { manifestCounts } from '@/staff/counts';
import { colors, space, font, SCREEN, radius, control } from '@/theme';
import { formatDate, formatTime, formatUGX } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import { ask } from '@/lib/dialog';

type CrewRole = 'driver' | 'conductor';
const FARE_MIN = 1000;
const FARE_MAX = 500000;

export default function AdminTrip() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const adapter = useAdapter();
  const mode = useAppMode();
  const epoch = useDataEpoch();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<CrewRole | null>(null);
  const [fare, setFare] = useState<string | null>(null);

  const trip = useAsync(() => adapter.getTrip(String(tripId)), [tripId, epoch, tick]);
  const manifest = useAsync(() => adapter.getTripManifest(String(tripId)), [tripId, epoch, tick]);
  const staff = useAsync(() => adapter.listStaff(), [epoch, tick]);
  const t = trip.data;
  const counts = useMemo(() => manifestCounts(manifest.data ?? []), [manifest.data]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    if (busy) return;
    setBusy(true);
    try { await fn(); haptics.success(); toast(ok, 'ok'); setTick((n) => n + 1); }
    catch (e) { haptics.warning(); toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }

  if (!t) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <NavBar title="Departure" onBack={() => router.back()} />
        <View style={{ padding: SCREEN }}>
          {trip.loading ? <Loading /> : trip.error ? <ErrorRow message={trip.error} onRetry={() => setTick((n) => n + 1)} /> : <EmptyState title="Departure not found" />}
        </View>
      </View>
    );
  }

  const line = lineFor(t.operatorId, t.operatorName);
  const cities = DIRECTION_CITIES[t.direction];
  const closed = t.status === 'completed' || t.status === 'cancelled';
  const stops = [...t.stops].sort((a, b) => a.stopOrder - b.stopOrder);
  const candidates = (role: CrewRole) => (staff.data ?? []).filter((s) => s.role === role && (!s.operatorId || s.operatorId === t.operatorId));

  function delay() {
    ask('Add a delay', 'Passengers on this departure are notified.', [
      ...[10, 20, 30, 60].map((m) => ({ text: `+${m} min`, onPress: () => act(() => adapter.reportDelay(t!.id, m), `Delay +${m} min recorded.`) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }
  function cancel() {
    const n = counts.expected;
    ask('Cancel this departure?', `${n} booked seat${n === 1 ? '' : 's'} will be released and passengers told. This can’t be undone.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Vehicle unavailable', style: 'destructive', onPress: () => act(() => adapter.cancelTrip(t!.id, 'Vehicle unavailable'), 'Departure cancelled.') },
      { text: 'Too few bookings', style: 'destructive', onPress: () => act(() => adapter.cancelTrip(t!.id, 'Too few bookings'), 'Departure cancelled.') },
    ]);
  }
  function saveFare() {
    const v = Number((fare ?? '').replace(/[^0-9]/g, ''));
    if (!Number.isFinite(v) || v < FARE_MIN || v > FARE_MAX) { toast(`Fares must be between ${formatUGX(FARE_MIN)} and ${formatUGX(FARE_MAX)}.`, 'error'); return; }
    act(() => adapter.operatorUpdateTrip(t!.id, { fareUgx: v }), 'Fare updated for new bookings.').then(() => setFare(null));
  }
  function assign(role: CrewRole, staffId: string | null) {
    setPicker(null);
    act(() => adapter.assignCrew(t!.id, role, staffId), staffId ? `${role === 'driver' ? 'Driver' : 'Conductor'} assigned.` : `${role === 'driver' ? 'Driver' : 'Conductor'} removed.`);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NavBar title="Departure" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: insets.bottom + space.xxl, gap: space.md }}>
        <View style={styles.head}>
          <LineBadge code={line.code} color={line.color} size="lg" />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{formatTime(t.originDeparture)} · {cities.origin} → {cities.destination}</Text>
            <Text style={styles.sub}>{t.operatorName}{t.vehicleLabel ? ` · ${t.vehicleLabel}` : ''} · {formatDate(t.serviceDate)}</Text>
          </View>
        </View>
        <TripStatusPill status={t.status} delayed={t.delayMinutes > 0} />

        <View style={styles.grid}>
          <StatTile label="Booked" value={`${t.seatsReserved}/${t.capacity}`} />
          <StatTile label="Checked in" value={counts.checkedIn} />
          <StatTile label="On board" value={counts.boarded} tone={colors.forest700} />
        </View>

        <SectionHeading title="Crew" />
        <Group>
          <ListRow icon="bus-outline" iconColor="#1f5fd1" title={t.driverName ?? 'No driver'} subtitle="Driver" danger={!t.driverName && !closed} onPress={closed ? undefined : () => setPicker('driver')} />
          <Separator inset={SCREEN + 44} />
          <ListRow icon="ticket-outline" title={t.conductorName ?? 'No conductor'} subtitle="Conductor" danger={!t.conductorName && !closed} onPress={closed ? undefined : () => setPicker('conductor')} />
        </Group>

        <SectionHeading title="Fare" />
        <Group style={{ paddingHorizontal: space.lg }}>
          {fare === null ? (
            <Pressable onPress={() => !closed && setFare(String(t.fareUgx))} accessibilityRole="button" accessibilityLabel={`Fare ${formatUGX(t.fareUgx)}. Edit.`}>
              <KeyValue label={closed ? 'Fare per seat' : 'Fare per seat · tap to edit'} value={formatUGX(t.fareUgx)} />
            </Pressable>
          ) : (
            <View style={styles.fareEdit}>
              <Text style={styles.ugx}>UGX</Text>
              <TextInput style={styles.fareInput} value={fare} onChangeText={setFare} keyboardType="number-pad" autoFocus accessibilityLabel="New fare in UGX" />
              <Pressable onPress={() => setFare(null)} accessibilityRole="button" style={styles.fareBtn}><Text style={styles.fareCancel}>Cancel</Text></Pressable>
              <Pressable onPress={saveFare} accessibilityRole="button" style={styles.fareBtn}><Text style={styles.fareSave}>Save</Text></Pressable>
            </View>
          )}
        </Group>
        <Text style={styles.hint}>Fare changes apply to new bookings only. Passengers keep the fare they were quoted.</Text>

        {!closed && (
          <View style={styles.actions}>
            <View style={{ flex: 1 }}><PrimaryButton title="Add delay" icon="time-outline" accent onPress={delay} disabled={busy} /></View>
            <View style={{ flex: 1 }}><PrimaryButton title="Cancel trip" icon="close-circle-outline" danger onPress={cancel} disabled={busy} /></View>
          </View>
        )}

        <SectionHeading title="Pickups" />
        <Group style={{ paddingHorizontal: space.lg }}>
          {stops.map((s, i) => (
            <View key={s.id}>
              {i > 0 && <Separator />}
              <KeyValue label={`${s.hubName}${s.reached ? ' · departed' : ''}`} value={formatTime(s.pickupTime)} />
            </View>
          ))}
          <Separator />
          <KeyValue label={`Arrive ${cities.destination}`} value={formatTime(t.destinationArrival)} />
        </Group>

        <SectionHeading title={`Passengers · ${manifest.data?.length ?? 0}`} />
        {manifest.data && manifest.data.length === 0 && <Text style={styles.hint}>No reservations yet.</Text>}
        {manifest.data && manifest.data.length > 0 && (
          <Group>
            {manifest.data.map((r, i) => (
              <View key={r.bookingId}>
                {i > 0 && <Separator inset={SCREEN} />}
                <View style={styles.paxRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paxName} numberOfLines={1}>{r.passengerName}</Text>
                    <Text style={styles.paxMeta}>{r.reference} · {r.seats} seat{r.seats === 1 ? '' : 's'} · {stops.find((s) => s.hubId === r.pickupHubId)?.hubName ?? 'Hub'}</Text>
                  </View>
                  <BookingStatusPill status={r.status} />
                </View>
              </View>
            ))}
          </Group>
        )}
      </ScrollView>

      <SelectSheet visible={!!picker} title={picker === 'driver' ? 'Assign driver' : 'Assign conductor'} onClose={() => setPicker(null)}>
        {picker && (
          <>
            {candidates(picker).length === 0 && (mode === 'connected' ? (
              <Banner tone="info" title="Crew directory not available here">Assign crew from the web operator console for now — it looks up staff accounts securely.</Banner>
            ) : (
              <Banner tone="warn" title={`No ${picker}s on ${t.operatorName}’s crew`}>Add crew to this operator before assigning them to its departures.</Banner>
            ))}
            <Group>
              {candidates(picker).map((s, i) => {
                const current = (picker === 'driver' ? t.driverName : t.conductorName) === s.name;
                return (
                  <View key={s.id}>
                    {i > 0 && <Separator inset={SCREEN} />}
                    <Pressable onPress={() => assign(picker, s.id)} accessibilityRole="button" accessibilityState={{ selected: current }} style={({ pressed }) => [styles.pick, pressed && { backgroundColor: colors.forest50 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickName}>{s.name}</Text>
                        <Text style={styles.pickMeta}>{s.operatorName ?? 'Operator'} · {s.assignedTripCount} trip{s.assignedTripCount === 1 ? '' : 's'} today</Text>
                      </View>
                      {current && <Ionicons name="checkmark" size={22} color={colors.forest700} />}
                    </Pressable>
                  </View>
                );
              })}
            </Group>
            {(picker === 'driver' ? t.driverName : t.conductorName) && mode === 'demo' && (
              <Pressable onPress={() => assign(picker, null)} accessibilityRole="button" style={styles.unassign}>
                <Text style={styles.unassignText}>Remove current {picker}</Text>
              </Pressable>
            )}
            <Text style={styles.hint}>Only {picker}s from {t.operatorName} are listed. Someone already crewing an overlapping trip can’t be assigned.</Text>
          </>
        )}
      </SelectSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  title: { fontSize: font.h2, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  sub: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  grid: { flexDirection: 'row', gap: space.sm },
  hint: { fontSize: font.tiny, color: colors.muted, paddingHorizontal: space.xs, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: space.sm },
  fareEdit: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 },
  ugx: { fontSize: font.small, color: colors.muted, fontWeight: '600' },
  fareInput: { flex: 1, fontSize: font.title, fontWeight: '700', color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.forest700, paddingVertical: 6 },
  fareBtn: { paddingHorizontal: 8, minHeight: control.small, justifyContent: 'center' },
  fareCancel: { color: colors.muted, fontWeight: '600' },
  fareSave: { color: colors.forest700, fontWeight: '800' },
  paxRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: SCREEN, paddingVertical: 11 },
  paxName: { fontSize: font.body, fontWeight: '600', color: colors.ink },
  paxMeta: { fontSize: font.tiny, color: colors.muted, marginTop: 1 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: SCREEN, minHeight: control.height + 6, paddingVertical: 8 },
  pickName: { fontSize: font.body, fontWeight: '600', color: colors.ink },
  pickMeta: { fontSize: font.tiny, color: colors.muted, marginTop: 1 },
  unassign: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.lg },
  unassignText: { color: colors.red700, fontWeight: '600', fontSize: font.body },
});
