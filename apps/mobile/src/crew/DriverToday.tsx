import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Group, PrimaryButton, Loading, ErrorRow, EmptyState, Separator, SectionHeading, KeyValue, Banner, LineBadge } from '@/components/ui';
import { TripStatusPill } from '@/components/StatusPill';
import { useAdapter, useAppMode, useDataEpoch } from '@/data/AdapterProvider';
import { useAsync, humanError } from '@/hooks/useAsync';
import { useNow, leadTime } from '@/hooks/useNow';
import { useToast } from '@/components/ToastProvider';
import { haptics } from '@/lib/feedback';
import { lineFor } from '@/lib/lines';
import { colors, radius, space, font, SCREEN } from '@/theme';
import { formatTime } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import { manifestCounts } from '@/staff/counts';
import { CrewHeader, HeaderStat } from './CrewHeader';
import { TripPicker } from './TripPicker';
import { pickActiveTrip } from './activeTrip';
import { ask } from '@/lib/dialog';

export function DriverToday({ staffId, tripParam }: { staffId: string; tripParam?: string }) {
  const adapter = useAdapter();
  const mode = useAppMode();
  const epoch = useDataEpoch();
  const toast = useToast();
  const now = useNow(30000);
  const [tripId, setTripId] = useState<string | undefined>(tripParam);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const trips = useAsync(() => adapter.staffTrips(staffId), [staffId, tick, epoch]);
  const list = trips.data ?? [];
  const active = pickActiveTrip(list, tripId ?? tripParam);
  const manifest = useAsync(() => (active ? adapter.getTripManifest(active.id) : Promise.resolve([])), [active?.id, tick]);
  const counts = useMemo(() => manifestCounts(manifest.data ?? []), [manifest.data]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    if (busy) return;
    setBusy(true);
    try { await fn(); haptics.success(); toast(ok, 'ok'); setTick((n) => n + 1); }
    catch (e) { haptics.warning(); toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }
  function confirm(title: string, message: string, onYes: () => void, destructive = true) {
    ask(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', style: destructive ? 'destructive' : 'default', onPress: onYes }]);
  }
  function delayMenu() {
    if (!active) return;
    ask('Report a delay', 'Passengers waiting at upcoming hubs are told straight away.', [
      ...[10, 20, 30].map((m) => ({ text: `+${m} min`, onPress: () => act(() => adapter.reportDelay(active.id, m), `Delay of ${m} min reported.`) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  const stops = active ? [...active.stops].sort((a, b) => a.stopOrder - b.stopOrder) : [];
  const nextStop = stops.find((s) => !s.reached);
  const cities = active ? DIRECTION_CITIES[active.direction] : null;
  const running = !!active && (active.status === 'en_route' || active.status === 'boarding');
  const finished = !!active && (active.status === 'completed' || active.status === 'cancelled');
  const line = active ? lineFor(active.operatorId, active.operatorName) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <CrewHeader>
        <TripPicker trips={list} activeId={active?.id} onSelect={setTripId} />
        {active && (
          <View style={styles.headerStats}>
            <HeaderStat label="Expected" value={counts.expected} />
            <HeaderStat label="Checked in" value={counts.checkedIn} />
            <HeaderStat label="On board" value={counts.boarded} tone={colors.live} />
          </View>
        )}
      </CrewHeader>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SCREEN, paddingBottom: space.xxl, gap: space.md }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setTick((n) => n + 1)} tintColor={colors.forest700} />}>
        {trips.loading && !trips.data && <Loading />}
        {trips.error && <ErrorRow message={trips.error} onRetry={() => setTick((n) => n + 1)} />}
        {!trips.loading && list.length === 0 && (
          <EmptyState title="No trips assigned today">When operations assigns you to a departure it shows up here.</EmptyState>
        )}

        {active && cities && line && (
          <>
            {/* Next stop — the one thing a driver needs at a glance */}
            <View style={styles.nextCard}>
              <View style={styles.nextTop}>
                <LineBadge code={line.code} color={line.color} />
                <Text style={styles.route}>{cities.origin} → {cities.destination}</Text>
                <TripStatusPill status={active.status} delayed={active.delayMinutes > 0} />
              </View>
              {finished ? (
                <Text style={styles.nextTitle}>{active.status === 'completed' ? 'Trip complete — thank you' : 'Trip cancelled'}</Text>
              ) : nextStop ? (
                <>
                  <Text style={styles.nextKicker}>{running ? 'Next pickup' : 'First pickup'}</Text>
                  <Text style={styles.nextTitle}>{nextStop.hubName}</Text>
                  <Text style={styles.nextTime}>{formatTime(nextStop.pickupTime)} · {leadTime(nextStop.pickupTime, now)}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.nextKicker}>All pickups done</Text>
                  <Text style={styles.nextTitle}>Drive to {cities.destination}</Text>
                  <Text style={styles.nextTime}>Arrive about {formatTime(active.destinationArrival)}</Text>
                </>
              )}

              <View style={{ gap: space.sm, marginTop: space.md }}>
                {active.status === 'scheduled' && (
                  <PrimaryButton title="Start trip" icon="play" onPress={() => confirm('Start trip?', `Passengers at ${stops[0]?.hubName ?? 'the first hub'} will see the bus is on its way.`, () => act(() => adapter.updateTripStatus(active.id, 'en_route'), 'Trip started.'), false)} loading={busy} />
                )}
                {running && nextStop && (
                  <PrimaryButton title={`Arrived at ${nextStop.hubName}`} icon="flag" onPress={() => act(() => adapter.reachHub(active.id, nextStop.hubId), `Arrived at ${nextStop.hubName}.`)} loading={busy} />
                )}
                {running && !nextStop && (
                  <PrimaryButton title="Complete trip" icon="checkmark-done" onPress={() => confirm('Complete trip?', 'Passengers not boarded will be recorded as not travelling.', () => act(() => adapter.updateTripStatus(active.id, 'completed'), 'Trip completed.'))} loading={busy} />
                )}
              </View>
            </View>

            {!finished && (
              <View style={styles.actionsRow}>
                <ActionTile icon="time-outline" label="Report delay" onPress={delayMenu} />
                <ActionTile icon="warning-outline" label="Breakdown" danger onPress={() => confirm('Report a breakdown?', 'This cancels the trip, releases every seat and tells passengers. Only do this if the bus can’t continue.', () => act(() => adapter.cancelTrip(active.id, 'Vehicle breakdown reported by driver'), 'Breakdown reported. Operations notified.'))} />
                {running && nextStop && (
                  <ActionTile icon="stop-circle-outline" label="End early" onPress={() => confirm('End trip now?', 'Remaining hubs will be skipped.', () => act(() => adapter.updateTripStatus(active.id, 'completed'), 'Trip completed.'))} />
                )}
              </View>
            )}

            <SectionHeading title="Route" />
            <Group style={{ padding: space.lg }}>
              {stops.map((s, i) => (
                <View key={s.id} style={styles.stopRow}>
                  <View style={styles.rail}>
                    <View style={[styles.stopDot, s.reached && { backgroundColor: line.color, borderColor: line.color }, s === nextStop && running && { borderColor: colors.live, borderWidth: 3 }]} />
                    <View style={[styles.stopLine, { backgroundColor: s.reached ? line.color : colors.separator }]} />
                  </View>
                  <View style={{ flex: 1, paddingBottom: space.md }}>
                    <Text style={[styles.stopName, s.reached && { color: colors.muted }]}>{s.hubName}</Text>
                    <Text style={styles.stopMeta}>{formatTime(s.pickupTime)}{s.reached ? ' · departed' : s === nextStop && running ? ' · next' : ''}</Text>
                  </View>
                  {i === 0 && <Text style={styles.stopTag}>Start</Text>}
                </View>
              ))}
              <View style={styles.stopRow}>
                <View style={styles.rail}><Ionicons name="flag" size={14} color={colors.red600} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopName}>{cities.destination}</Text>
                  <Text style={styles.stopMeta}>Arrive about {formatTime(active.destinationArrival)}</Text>
                </View>
              </View>
            </Group>

            <SectionHeading title="Trip" />
            <Group style={{ paddingHorizontal: space.lg }}>
              <KeyValue label="Vehicle" value={active.vehicleLabel ?? '—'} />
              <Separator />
              <KeyValue label="Conductor" value={active.conductorName ?? 'Not assigned'} tone={active.conductorName ? undefined : colors.amber800} />
              <Separator />
              <KeyValue label="Departs origin" value={formatTime(active.originDeparture)} />
              <Separator />
              <KeyValue label="Seats booked" value={`${active.seatsReserved} of ${active.capacity}`} />
            </Group>

            <Banner tone="info" icon={mode === 'demo' ? 'navigate-circle-outline' : 'navigate'} title={mode === 'demo' ? 'Location is simulated in preview' : running ? 'Sharing location while this screen is open' : 'Location sharing starts with the trip'}>
              {mode === 'demo' ? 'No GPS is used. Passengers see progress as you mark hubs reached.' : 'There is no background tracking. Keep the app open while driving with the phone mounted.'}
            </Banner>
            <Text style={styles.safety}>Use controls only while the bus is stopped.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ActionTile({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={22} color={danger ? colors.red700 : colors.forest700} />
      <Text style={[styles.tileText, danger && { color: colors.red700 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerStats: { flexDirection: 'row', gap: space.md },
  nextCard: { backgroundColor: colors.surface, borderRadius: radius.xxl, padding: space.lg },
  nextTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.md },
  route: { flex: 1, fontSize: font.small, fontWeight: '700', color: colors.inkSoft },
  nextKicker: { fontSize: font.tiny, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  nextTitle: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.5, marginTop: 2 },
  nextTime: { fontSize: font.body, color: colors.forest700, fontWeight: '700', marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: space.md, alignItems: 'center', gap: 6, minHeight: 72, justifyContent: 'center' },
  tileText: { fontSize: font.tiny, fontWeight: '700', color: colors.ink },
  stopRow: { flexDirection: 'row', gap: space.md },
  rail: { width: 18, alignItems: 'center' },
  stopDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.faint, backgroundColor: colors.surface, marginTop: 3 },
  stopLine: { flex: 1, width: 2, marginTop: 2 },
  stopName: { fontSize: font.body, fontWeight: '600', color: colors.ink },
  stopMeta: { fontSize: font.tiny, color: colors.muted, marginTop: 1 },
  stopTag: { fontSize: 11, color: colors.muted, fontWeight: '700' },
  safety: { textAlign: 'center', color: colors.muted, fontSize: font.tiny },
});
