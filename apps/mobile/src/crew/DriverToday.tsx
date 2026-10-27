import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Group, PrimaryButton, Loading, ErrorRow, EmptyState, Separator, SectionHeading, KeyValue, Banner, LineBadge } from '@/components/ui';
import { TripStatusPill } from '@/components/StatusPill';
import { useAdapter, useAppMode, useDataEpoch } from '@/data/AdapterProvider';
import { useAsync, humanError } from '@/hooks/useAsync';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { useNow, leadTime } from '@/hooks/useNow';
import { useToast } from '@/components/ToastProvider';
import { haptics } from '@/lib/feedback';
import { lineFor } from '@/lib/lines';
import { colors, radius, space, font, SCREEN } from '@/theme';
import { formatTime, timeAgo } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import { manifestCounts } from '@/staff/counts';
import { CrewHeader, HeaderStat } from './CrewHeader';
import { TripPicker } from './TripPicker';
import { pickActiveTrip } from './activeTrip';
import { useLocationSharing, type SharingState } from './useLocationSharing';
import { TransitMap } from '@/components/map/TransitMap';
import { tripMapData, pickupsByStop } from '@/components/map/tripMap';
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
  const [selStop, setSelStop] = useState<string | null>(null);

  const trips = useAsync(() => adapter.staffTrips(staffId), [staffId, tick, epoch]);
  useLiveRefresh(() => setTick((n) => n + 1));
  const list = trips.data ?? [];
  const active = pickActiveTrip(list, tripId ?? tripParam);
  const manifest = useAsync(() => (active ? adapter.getTripManifest(active.id) : Promise.resolve([])), [active?.id, tick, epoch]);
  const counts = useMemo(() => manifestCounts(manifest.data ?? []), [manifest.data]);
  const pickups = useMemo(() => pickupsByStop(manifest.data ?? []), [manifest.data]);
  const hubs = useAsync(() => adapter.listHubs(), [epoch]);

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
  const sharing = useLocationSharing(active?.id, running);

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
                  <PickupLine p={pickups.get(nextStop.hubId)} big />
                  {!(pickups.get(nextStop.hubId)?.toPickUp) && (() => {
                    const ahead = stops.find((x) => !x.reached && x !== nextStop && (pickups.get(x.hubId)?.toPickUp ?? 0) > 0);
                    return ahead ? (
                      <Text style={styles.ahead}>Next passengers: <Text style={{ fontWeight: '800', color: colors.ink }}>{ahead.hubName}</Text> · {pickups.get(ahead.hubId)!.toPickUp} at {formatTime(ahead.pickupTime)}</Text>
                    ) : null;
                  })()}
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

            <SectionHeading title="Route & pickups" />
            {hubs.data && (() => {
              const m = tripMapData(active, hubs.data, now, { pickups, demo: mode === 'demo' });
              return <TransitMap height={230} routes={m.routes} stops={m.stops} buses={m.buses} focus={m.focus} caption={selStop ? 'Tap the map to clear' : `${m.caption} · tap a stop`}
                selectedId={selStop} onStopPress={(id) => { haptics.select(); setSelStop(id); }} onMapPress={() => setSelStop(null)} />;
            })()}
            {selStop && (() => {
              const st = stops.find((x) => x.hubId === selStop);
              const rows = (manifest.data ?? []).filter((r) => r.pickupHubId === selStop && r.status !== 'cancelled');
              return (
                <Group style={{ padding: space.lg, gap: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.stopName, { flex: 1 }]}>{st?.hubName ?? 'Stop'} · {formatTime(st?.pickupTime ?? active.originDeparture)}</Text>
                    <Pressable onPress={() => setSelStop(null)} accessibilityRole="button" accessibilityLabel="Close stop" hitSlop={8}><Ionicons name="close" size={18} color={colors.muted} /></Pressable>
                  </View>
                  {rows.length === 0 && <Text style={styles.pickNone}>Nobody booked from this stop.</Text>}
                  {rows.map((r) => (
                    <View key={r.bookingId} style={styles.paxLine}>
                      <Ionicons name={r.status === 'boarded' || r.status === 'completed' ? 'checkmark-circle' : r.status === 'checked_in' ? 'person' : 'person-outline'} size={16}
                        color={r.status === 'boarded' || r.status === 'completed' ? colors.forest600 : r.status === 'checked_in' ? colors.forest700 : colors.muted} />
                      <Text style={styles.paxName} numberOfLines={1}>{r.passengerName}</Text>
                      <Text style={styles.paxMeta}>{r.seats} seat{r.seats === 1 ? '' : 's'} · {r.status === 'checked_in' ? 'waiting at hub' : r.status === 'reserved' ? 'not checked in' : r.status === 'boarded' || r.status === 'completed' ? 'on board' : r.status.replace('_', ' ')}</Text>
                    </View>
                  ))}
                </Group>
              );
            })()}
            <Group style={{ padding: space.lg }}>
              {stops.map((s, i) => {
                const p = pickups.get(s.hubId);
                const isNext = s === nextStop && running;
                return (
                  <View key={s.id} style={styles.stopRow}>
                    <View style={styles.rail}>
                      <View style={[styles.stopDot, s.reached && { backgroundColor: line.color, borderColor: line.color }, isNext && { borderColor: colors.live, borderWidth: 3 }]} />
                      <View style={[styles.stopLine, { backgroundColor: s.reached ? line.color : colors.separator }]} />
                    </View>
                    <Pressable style={{ flex: 1, paddingBottom: space.md }} onPress={() => setSelStop(s.hubId)} accessibilityRole="button" accessibilityLabel={`${s.hubName}, show passengers`}>
                      <Text style={[styles.stopName, s.reached && { color: colors.muted }, selStop === s.hubId && { color: line.color }]}>{s.hubName}</Text>
                      <Text style={styles.stopMeta}>{formatTime(s.pickupTime)}{s.reached ? ' · departed' : isNext ? ' · next' : ''}{i === 0 ? ' · start' : ''}</Text>
                      {!s.reached && <PickupLine p={p} />}
                      {s.reached && p && p.boarded > 0 && <Text style={styles.stopMeta}>{p.boarded} boarded here</Text>}
                      {s.reached && p && p.toPickUp > 0 && <Text style={styles.leftBehind}>{p.toPickUp} booked here but not boarded — tell your conductor</Text>}
                    </Pressable>
                    {!s.reached && (
                      <View style={[styles.countPill, !(p?.toPickUp) && styles.countPillZero]} accessibilityLabel={`${p?.toPickUp ?? 0} to pick up`}>
                        <Text style={[styles.countPillText, !(p?.toPickUp) && { color: colors.muted }]}>{p?.toPickUp ?? 0}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
              <View style={styles.stopRow}>
                <View style={styles.rail}><Ionicons name="flag" size={14} color={colors.red600} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopName}>{cities.destination}</Text>
                  <Text style={styles.stopMeta}>Arrive about {formatTime(active.destinationArrival)}</Text>
                </View>
              </View>
            </Group>
            {stops.some((s) => !s.reached && !(pickups.get(s.hubId)?.toPickUp)) && (
              <Text style={styles.skipHint}>Stops showing 0 have no one booked — you can pass straight through unless someone flags you.</Text>
            )}

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

            <SharingBanner state={sharing} />
            <Text style={styles.safety}>Use controls only while the bus is stopped.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SharingBanner({ state }: { state: SharingState }) {
  switch (state.kind) {
    case 'simulated':
      return <Banner tone="info" icon="navigate-circle-outline" title="Location is simulated in preview">No GPS is used. Passengers see the bus move as you mark hubs reached.</Banner>;
    case 'off':
      return <Banner tone="info" icon="navigate-outline" title="Location sharing starts with the trip">While the trip runs and this screen is open, your phone shares the bus position with passengers. There is no background tracking.</Banner>;
    case 'asking':
      return <Banner tone="info" icon="navigate-outline" title="Turning on location…">Allow location so passengers can see where the bus is.</Banner>;
    case 'denied':
      return <Banner tone="warn" title="Location is off">Passengers only see an estimate from the timetable. Allow location for ToGo Staff in Settings to share the bus position.</Banner>;
    case 'error':
      return <Banner tone="warn" title="Couldn’t send location">{state.message}. It will retry with the next position.</Banner>;
    case 'sharing':
      return (
        <Banner tone="ok" icon="navigate" title="Sharing bus location">
          {state.lastSentAt ? `Last sent ${timeAgo(state.lastSentAt.toISOString())}${state.accuracyM ? ` · ±${Math.round(state.accuracyM)} m` : ''}.` : 'Waiting for the first GPS fix…'} Keep this screen open while driving.
        </Banner>
      );
  }
}

function PickupLine({ p, big }: { p?: { toPickUp: number; checkedIn: number }; big?: boolean }) {
  const n = p?.toPickUp ?? 0;
  if (n === 0) return <Text style={[styles.pickNone, big && { marginTop: 6 }]}>No one to pick up here</Text>;
  return (
    <Text style={[big ? styles.pickBig : styles.pickSmall]}>
      Pick up <Text style={{ fontWeight: '900' }}>{n}</Text> passenger{n === 1 ? '' : 's'}
      <Text style={styles.pickChecked}>{`  ·  ${p!.checkedIn} checked in`}</Text>
    </Text>
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
  pickBig: { fontSize: font.body, color: colors.ink, marginTop: 6 },
  pickSmall: { fontSize: font.small, color: colors.ink, marginTop: 2 },
  pickChecked: { color: colors.muted, fontWeight: '400' },
  paxLine: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  paxName: { flex: 1, fontSize: font.body, fontWeight: '600', color: colors.ink },
  paxMeta: { fontSize: font.tiny, color: colors.muted },
  leftBehind: { fontSize: font.small, color: colors.amber800, fontWeight: '600', marginTop: 2 },
  ahead: { fontSize: font.small, color: colors.inkSoft, marginTop: 4 },
  pickNone: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  countPill: { minWidth: 34, height: 30, borderRadius: 15, paddingHorizontal: 8, backgroundColor: colors.forest700, alignItems: 'center', justifyContent: 'center' },
  countPillZero: { backgroundColor: colors.surfaceAlt },
  countPillText: { color: colors.white, fontWeight: '900', fontSize: font.small, fontVariant: ['tabular-nums'] },
  skipHint: { fontSize: font.tiny, color: colors.muted, paddingHorizontal: space.xs, lineHeight: 17 },
  safety: { textAlign: 'center', color: colors.muted, fontSize: font.tiny },
});
