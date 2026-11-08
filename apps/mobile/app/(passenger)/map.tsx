import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking, type LayoutChangeEvent } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TransitMap } from '@/components/map/TransitMap';
import { tripMapData } from '@/components/map/tripMap';
import { LineBadge } from '@/components/ui';
import { useAdapter, useAppMode, useDataEpoch } from '@/data/AdapterProvider';
import { useSearch } from '@/state/search';
import { useAsync } from '@/hooks/useAsync';
import { useNow, countdown, leadTime } from '@/hooks/useNow';
import { useToast } from '@/components/ToastProvider';
import { haptics } from '@/lib/feedback';
import { lineFor } from '@/lib/lines';
import { colors, space, font, radius, SCREEN } from '@/theme';
import { kampalaToday, formatTime, formatUGX } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import { tripJourney } from '@shared/data/journey';
import { hubPoint, distanceKm, formatDistance, isFreshFix, type LatLng } from '@shared/data/geo';
import { useMyLocation } from '@/location/useMyLocation';
import type { DirectionCode, TripView } from '@shared/data/adapter';

type Selection = { kind: 'stop'; id: string } | { kind: 'bus'; id: string } | null;

/**
 * Live map, Transit-style: every bus on the road for a direction, the pickup hubs,
 * and a bottom sheet that follows what you tap — a stop shows its next departures,
 * a bus shows where it's heading and when it reaches each hub, and you can follow it.
 */
export default function LiveMap() {
  const params = useLocalSearchParams<{ trip?: string; hub?: string; follow?: string }>();
  const adapter = useAdapter();
  const mode = useAppMode();
  const epoch = useDataEpoch();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const now = useNow(15000);
  const { criteria, set } = useSearch();

  const [direction, setDirection] = useState<DirectionCode>(criteria.direction);
  const [sel, setSel] = useState<Selection>(params.hub ? { kind: 'stop', id: params.hub } : null);
  const [following, setFollowing] = useState(params.follow === '1');
  const [expanded, setExpanded] = useState(true);
  const [sheetH, setSheetH] = useState(0);
  const [refit, setRefit] = useState(0);
  // The passenger's own position: follows them while the map is open.
  const myLocation = useMyLocation();
  const me = myLocation.coord;
  // Frame the map around where they were first seen, not every step they take.
  const [fitMe, setFitMe] = useState<LatLng | null>(null);
  useEffect(() => { if (me && !fitMe) setFitMe(me); }, [me, fitMe]);

  const today = kampalaToday(now);
  const hubs = useAsync(() => adapter.listHubs(), [epoch]);
  // Refresh trips every 30s so buses keep moving with crew updates.
  const tick = Math.floor(now.getTime() / 30000);
  const trips = useAsync(() => adapter.searchTrips({ direction, date: today }), [direction, today, epoch, tick]);
  const bookings = useAsync(() => adapter.myBookings(), [epoch, tick]);
  const paramTrip = useAsync(() => (params.trip ? adapter.getTrip(params.trip) : Promise.resolve(null)), [params.trip, epoch, tick]);

  // Opening a specific trip: switch to its direction and select its bus (or its stop).
  useEffect(() => {
    const t = paramTrip.data;
    if (!t) return;
    if (t.direction !== direction) setDirection(t.direction);
    if (!params.hub && (t.status === 'en_route' || t.status === 'boarding')) setSel({ kind: 'bus', id: t.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramTrip.data?.id, paramTrip.data?.status]);

  // Opening on a hub: show the direction that departs from that hub's city.
  useEffect(() => {
    if (!params.hub || params.trip || !hubs.data) return;
    const h = hubs.data.find((x) => x.id === params.hub);
    if (h) setDirection(h.city === 'Mbarara' ? 'MBR_KLA' : 'KLA_MBR');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.hub, hubs.data]);

  const cities = DIRECTION_CITIES[direction];
  const allHubs = useMemo(() => hubs.data ?? [], [hubs.data]);
  const list: TripView[] = useMemo(() => {
    const base = trips.data ?? [];
    const extra = paramTrip.data && paramTrip.data.direction === direction && !base.some((t) => t.id === paramTrip.data!.id) ? [paramTrip.data] : [];
    return [...base, ...extra];
  }, [trips.data, paramTrip.data, direction]);
  const myTripIds = new Set((bookings.data ?? []).filter((b) => ['reserved', 'checked_in', 'boarded'].includes(b.status)).map((b) => b.tripId));
  const myHubByTrip = new Map((bookings.data ?? []).filter((b) => ['reserved', 'checked_in', 'boarded'].includes(b.status)).map((b) => [b.tripId, b.pickupHubId]));

  // Real GPS fixes for buses on the road (connected mode); preview estimates instead.
  const liveIds = list.filter((t) => t.status === 'en_route' || t.status === 'boarding').map((t) => t.id);
  const liveKey = liveIds.join(',');
  const fixes = useAsync(
    async () => (mode === 'connected'
      ? new Map(await Promise.all(liveIds.map(async (id) => [id, await adapter.latestLocation(id).catch(() => null)] as const)))
      : new Map()),
    [liveKey, tick, mode],
  );
  // Move a bus as soon as its driver's phone sends a fix, not only on the 30 s refresh.
  useEffect(() => {
    if (mode !== 'connected' || !liveKey) return;
    const subs = liveKey.split(',').map((id) => adapter.subscribeTrip(id, () => {}, () => fixes.reload()));
    return () => subs.forEach((s) => s.unsubscribe());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, mode, liveKey]);
  const data = useMemo(() => list.map((t) => {
    const fix = fixes.data?.get(t.id) ?? null;
    // Old fixes fall back to the schedule estimate (same rule as the trip screen).
    const fresh = isFreshFix(fix, now) ? fix : null;
    return { t, m: tripMapData(t, allHubs, now, { demo: mode === 'demo', fix: fresh }) };
  }), [list, allHubs, now, mode, fixes.data]);
  const running = data.filter(({ t }) => t.status === 'en_route' || t.status === 'boarding');
  const originHubs = allHubs.filter((h) => h.city === cities.origin && hubPoint(h));

  const selectedTrip = sel?.kind === 'bus' ? data.find(({ t }) => t.id === sel.id) : undefined;
  const selectedHub = sel?.kind === 'stop' ? allHubs.find((h) => h.id === sel.id) : undefined;
  const busCoord = selectedTrip?.m.buses[0]?.coord ?? null;

  // Map layers: the corridor faintly, the selected bus's route in its line colour.
  const corridor = data[0]?.m.routes[0];
  const routes = [
    ...(corridor ? [{ ...corridor, id: 'corridor', dimmed: true }] : []),
    ...(selectedTrip ? selectedTrip.m.routes : []),
  ];
  const stops = originHubs.map((h) => ({
    id: h.id,
    coord: hubPoint(h)!,
    label: h.name,
    color: colors.forest700,
    highlight: [...myHubByTrip.values()].includes(h.id),
  }));
  const buses = running.flatMap(({ m }) => m.buses);
  const focus = selectedTrip
    ? [...selectedTrip.m.stops.map((s) => s.coord), ...selectedTrip.m.buses.map((b) => b.coord)]
    : selectedHub && hubPoint(selectedHub)
      ? [hubPoint(selectedHub)!, ...originHubs.map((h) => hubPoint(h)!)]
      // Default view frames the pickup hubs near you (and you); buses further down
      // the corridor are listed in the sheet — tap one to fly to it.
      : stops.length > 0 ? [...stops.map((s) => s.coord), ...(fitMe ? [fitMe] : [])] : buses.map((b) => b.coord);

  async function locateMe() {
    const found = me ? { coord: me, denied: false } : await myLocation.enable();
    const here = found.coord;
    if (!here) {
      toast(found.denied
        ? 'Location is off — allow it in Settings to find your nearest hub.'
        : 'Couldn’t get your location. Try again outside or check Settings.', 'error');
      return;
    }
    {
      const nearest = originHubs
        .map((h) => ({ h, d: distanceKm(here, hubPoint(h)!) }))
        .sort((a, b) => a.d - b.d)[0];
      if (nearest && nearest.d < 60) {
        setFollowing(false);
        setSel({ kind: 'stop', id: nearest.h.id });
        toast(`Nearest hub: ${nearest.h.name} · ${formatDistance(nearest.d)}`, 'ok');
      } else {
        setRefit((n) => n + 1);
        toast(`You're not near a ${cities.origin} hub right now.`, 'ok');
      }
      haptics.select();
    }
  }

  function selectStop(id: string) { haptics.select(); setFollowing(false); setSel({ kind: 'stop', id }); setExpanded(true); }
  function selectBus(id: string) { haptics.select(); setSel({ kind: 'bus', id }); setExpanded(true); }
  function swap() {
    haptics.select();
    const next = direction === 'KLA_MBR' ? 'MBR_KLA' : 'KLA_MBR';
    setDirection(next); set({ direction: next, hubId: null }); setSel(null); setFollowing(false); setRefit((n) => n + 1);
  }
  function book(t: TripView, hubId?: string) {
    const j = tripJourney(t, hubId ?? null);
    router.push(`/book/${t.id}?hub=${j.pickup?.hubId ?? ''}&pax=${criteria.passengers}`);
  }

  const onSheetLayout = (e: LayoutChangeEvent) => setSheetH(e.nativeEvent.layout.height);
  const sheetCaption = running.length ? `${running.length} bus${running.length === 1 ? '' : 'es'} on the road` : 'No buses on the road right now';

  return (
    <View style={styles.root}>
      <TransitMap
        fill
        routes={routes}
        stops={stops}
        buses={buses}
        focus={focus}
        selectedId={sel?.id ?? null}
        onStopPress={selectStop}
        onBusPress={selectBus}
        onMapPress={() => { setSel(null); setFollowing(false); }}
        follow={following && busCoord ? busCoord : null}
        refitToken={refit}
        userLocation={me}
        bottomInset={sheetH}
        topInset={insets.top + 56}
        caption={mode === 'demo' ? `${sheetCaption} · simulated` : sheetCaption}
      />

      {/* Top bar */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close map" style={styles.roundBtn}>
          <Ionicons name="chevron-down" size={22} color={colors.ink} />
        </Pressable>
        <Pressable onPress={swap} accessibilityRole="button" accessibilityLabel={`${cities.origin} to ${cities.destination}. Swap direction.`} style={styles.dirPill}>
          <Text style={styles.dirText} numberOfLines={1}>{cities.origin} → {cities.destination}</Text>
          <Ionicons name="swap-horizontal" size={16} color={colors.forest700} />
        </Pressable>
      </View>

      {/* Floating controls */}
      <View style={[styles.controls, { bottom: sheetH + 12 }]} pointerEvents="box-none">
        {selectedTrip && (
          <Pressable onPress={() => { haptics.select(); setFollowing((f) => !f); }} accessibilityRole="button" accessibilityState={{ selected: following }}
            accessibilityLabel={following ? 'Stop following bus' : 'Follow bus'} style={[styles.roundBtn, following && styles.roundBtnOn]}>
            <Ionicons name="navigate" size={20} color={following ? colors.white : colors.forest700} />
          </Pressable>
        )}
        <Pressable onPress={() => { setFollowing(false); setSel(null); setRefit((n) => n + 1); }} accessibilityRole="button" accessibilityLabel="Show everything" style={styles.roundBtn}>
          <Ionicons name="scan-outline" size={20} color={colors.ink} />
        </Pressable>
        <Pressable onPress={locateMe} accessibilityRole="button" accessibilityLabel="Find my nearest hub" style={styles.roundBtn}>
          <Ionicons name="locate" size={20} color={colors.forest700} />
        </Pressable>
      </View>

      {/* Bottom sheet */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]} onLayout={onSheetLayout}>
        <Pressable onPress={() => setExpanded((e) => !e)} accessibilityRole="button" accessibilityLabel={expanded ? 'Collapse panel' : 'Expand panel'} style={styles.handleHit}>
          <View style={styles.handle} />
        </Pressable>
        {selectedTrip ? (
          <BusPanel t={selectedTrip.t} now={now} expanded={expanded} mine={myTripIds.has(selectedTrip.t.id)} myHubId={myHubByTrip.get(selectedTrip.t.id)}
            following={following} onFollow={() => setFollowing((f) => !f)} onStop={selectStop} onBook={(hubId) => book(selectedTrip.t, hubId)}
            onClose={() => { setSel(null); setFollowing(false); }} />
        ) : selectedHub ? (
          <StopPanel hubId={selectedHub.id} name={selectedHub.name} area={selectedHub.area} lat={selectedHub.lat} lng={selectedHub.lng}
            trips={list} now={now} expanded={expanded} myTripIds={myTripIds}
            onBus={selectBus} onBook={(t) => book(t, selectedHub.id)} onHub={() => router.push(`/hub/${selectedHub.id}`)} onClose={() => setSel(null)} />
        ) : (
          <OverviewPanel running={running.map(({ t }) => t)} upcoming={list.filter((t) => t.status === 'scheduled' && new Date(t.originDeparture).getTime() > now.getTime() - 60000)}
            now={now} expanded={expanded} myTripIds={myTripIds} cities={cities} onBus={selectBus} onBook={(t) => book(t)} loading={trips.loading && !trips.data} />
        )}
      </View>
    </View>
  );
}

function PanelHead({ line, title, sub, onClose }: { line?: { code: string; color: string }; title: string; sub?: string; onClose?: () => void }) {
  return (
    <View style={styles.panelHead}>
      {line && <LineBadge code={line.code} color={line.color} size="lg" />}
      <View style={{ flex: 1 }}>
        <Text style={styles.panelTitle} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={styles.panelSub} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {onClose && (
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color={colors.inkSoft} />
        </Pressable>
      )}
    </View>
  );
}

function BigCountdown({ iso, now, live }: { iso: string; now: Date; live?: boolean }) {
  const cd = countdown(iso, now);
  return (
    <View style={{ alignItems: 'flex-end', minWidth: 56 }}>
      <Text style={[styles.big, live && { color: colors.forest600 }]}>{cd.value}</Text>
      {cd.unit ? <Text style={styles.unit}>{cd.unit}</Text> : null}
    </View>
  );
}

function OverviewPanel({ running, upcoming, now, expanded, myTripIds, cities, onBus, onBook, loading }: {
  running: TripView[]; upcoming: TripView[]; now: Date; expanded: boolean; myTripIds: Set<string>;
  cities: { origin: string; destination: string }; onBus: (id: string) => void; onBook: (t: TripView) => void; loading: boolean;
}) {
  return (
    <View>
      <PanelHead title={running.length ? 'On the road now' : `Next from ${cities.origin}`} sub={running.length ? 'Tap a bus to see where it is and follow it' : 'Tap a hub on the map to see its departures'} />
      {expanded && (
        <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ gap: 6 }}>
          {loading && <Text style={styles.empty}>Loading departures…</Text>}
          {running.map((t) => {
            const next = [...t.stops].sort((a, b) => a.stopOrder - b.stopOrder).find((s) => !s.reached);
            const line = lineFor(t.operatorId, t.operatorName);
            return (
              <Pressable key={t.id} onPress={() => onBus(t.id)} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <LineBadge code={line.code} color={line.color} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>To {cities.destination}{myTripIds.has(t.id) ? '  · your bus' : ''}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>{next ? `Next: ${next.hubName} ${leadTime(next.pickupTime, now)}` : 'On the highway'}{t.delayMinutes > 0 ? ` · +${t.delayMinutes} min` : ''}</Text>
                </View>
                <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>Live</Text></View>
              </Pressable>
            );
          })}
          {upcoming.slice(0, running.length ? 3 : 5).map((t) => {
            const line = lineFor(t.operatorId, t.operatorName);
            const first = [...t.stops].sort((a, b) => a.stopOrder - b.stopOrder)[0];
            return (
              <Pressable key={t.id} onPress={() => onBook(t)} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <LineBadge code={line.code} color={line.color} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>To {cities.destination}{myTripIds.has(t.id) ? '  · booked' : ''}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>{formatTime(first?.pickupTime ?? t.originDeparture)} from {first?.hubName ?? cities.origin} · {t.seatsAvailable} seats</Text>
                </View>
                <BigCountdown iso={first?.pickupTime ?? t.originDeparture} now={now} />
              </Pressable>
            );
          })}
          {!loading && running.length === 0 && upcoming.length === 0 && <Text style={styles.empty}>No more departures today in this direction.</Text>}
        </ScrollView>
      )}
    </View>
  );
}

function StopPanel({ hubId, name, area, lat, lng, trips, now, expanded, myTripIds, onBus, onBook, onHub, onClose }: {
  hubId: string; name: string; area: string; lat?: number | null; lng?: number | null; trips: TripView[]; now: Date; expanded: boolean; myTripIds: Set<string>;
  onBus: (id: string) => void; onBook: (t: TripView) => void; onHub: () => void; onClose: () => void;
}) {
  const departures = trips
    .map((t) => ({ t, stop: t.stops.find((s) => s.hubId === hubId) }))
    .filter((x): x is { t: TripView; stop: NonNullable<typeof x.stop> } => !!x.stop && !x.stop.reached && x.t.status !== 'completed')
    .filter((x) => new Date(x.stop.pickupTime).getTime() > now.getTime() - 5 * 60000 || x.t.status === 'en_route' || x.t.status === 'boarding')
    .sort((a, b) => a.stop.pickupTime.localeCompare(b.stop.pickupTime));
  return (
    <View>
      <PanelHead title={name} sub={area} onClose={onClose} />
      {expanded && (
        <>
          <View style={styles.actions}>
            {lat != null && lng != null && (
              <Pressable onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(() => {})} accessibilityRole="button" style={[styles.action, styles.actionPrimary]}>
                <Ionicons name="navigate" size={16} color={colors.white} /><Text style={[styles.actionText, { color: colors.white }]}>Directions</Text>
              </Pressable>
            )}
            <Pressable onPress={onHub} accessibilityRole="button" style={styles.action}>
              <Ionicons name="information-circle-outline" size={16} color={colors.forest700} /><Text style={styles.actionText}>Hub info</Text>
            </Pressable>
          </View>
          <Text style={styles.section}>Departures from this hub</Text>
          <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: 6 }}>
            {departures.length === 0 && <Text style={styles.empty}>No more departures from here today.</Text>}
            {departures.map(({ t, stop }) => {
              const line = lineFor(t.operatorId, t.operatorName);
              const live = t.status === 'en_route' || t.status === 'boarding';
              return (
                <Pressable key={t.id} onPress={() => (live ? onBus(t.id) : onBook(t))} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  <LineBadge code={line.code} color={line.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{formatTime(stop.pickupTime)} · {t.operatorName}{myTripIds.has(t.id) ? '  · booked' : ''}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>{live ? 'Bus on its way — tap to track' : `${t.seatsAvailable} seats · ${formatUGX(t.fareUgx)}`}{t.delayMinutes > 0 ? ` · +${t.delayMinutes} min` : ''}</Text>
                  </View>
                  <BigCountdown iso={stop.pickupTime} now={now} live={live} />
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}
    </View>
  );
}

function BusPanel({ t, now, expanded, mine, myHubId, following, onFollow, onStop, onBook, onClose }: {
  t: TripView; now: Date; expanded: boolean; mine: boolean; myHubId?: string; following: boolean;
  onFollow: () => void; onStop: (id: string) => void; onBook: (hubId?: string) => void; onClose: () => void;
}) {
  const line = lineFor(t.operatorId, t.operatorName);
  const cities = DIRECTION_CITIES[t.direction];
  const stops = [...t.stops].sort((a, b) => a.stopOrder - b.stopOrder);
  const ahead = stops.filter((s) => !s.reached);
  const myStop = myHubId ? stops.find((s) => s.hubId === myHubId) : undefined;
  const sub = [t.operatorName, t.vehicleLabel, t.delayMinutes > 0 ? `running ${t.delayMinutes} min late` : 'on schedule'].filter(Boolean).join(' · ');
  return (
    <View>
      <PanelHead line={line} title={`To ${cities.destination}`} sub={sub} onClose={onClose} />
      {expanded && (
        <>
          {mine && myStop && !myStop.reached && (
            <View style={styles.yours}>
              <Ionicons name="ticket" size={16} color={colors.forest700} />
              <Text style={styles.yoursText}>Your bus reaches <Text style={{ fontWeight: '800' }}>{myStop.hubName}</Text> {leadTime(myStop.pickupTime, now)}</Text>
            </View>
          )}
          <View style={styles.actions}>
            <Pressable onPress={onFollow} accessibilityRole="button" accessibilityState={{ selected: following }} style={[styles.action, following && styles.actionPrimary]}>
              <Ionicons name="navigate" size={16} color={following ? colors.white : colors.forest700} />
              <Text style={[styles.actionText, following && { color: colors.white }]}>{following ? 'Following' : 'Follow bus'}</Text>
            </Pressable>
            {!mine && ahead.length > 0 && t.seatsAvailable > 0 && (
              <Pressable onPress={() => onBook(ahead[0].hubId)} accessibilityRole="button" style={styles.action}>
                <Ionicons name="add-circle-outline" size={16} color={colors.forest700} /><Text style={styles.actionText}>Book a seat</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.section}>{ahead.length ? 'Upcoming stops' : `Heading to ${cities.destination}`}</Text>
          <ScrollView style={{ maxHeight: 200 }}>
            {ahead.map((s) => (
              <Pressable key={s.id} onPress={() => onStop(s.hubId)} accessibilityRole="button" style={styles.stopRow}>
                <View style={[styles.stopDot, { borderColor: line.color }, s.hubId === myHubId && { backgroundColor: line.color }]} />
                <Text style={styles.stopName} numberOfLines={1}>{s.hubName}{s.hubId === myHubId ? ' · your stop' : ''}</Text>
                <Text style={styles.stopTime}>{formatTime(s.pickupTime)}</Text>
              </Pressable>
            ))}
            <View style={styles.stopRow}>
              <Ionicons name="flag" size={14} color={colors.red600} style={{ width: 14 }} />
              <Text style={styles.stopName}>{cities.destination}</Text>
              <Text style={styles.stopTime}>{formatTime(t.destinationArrival)}</Text>
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
}

const shadow = { shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 6 };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceAlt },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: SCREEN },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
  roundBtnOn: { backgroundColor: colors.forest700 },
  dirPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, height: 44, borderRadius: 22, backgroundColor: colors.surface, paddingHorizontal: 16, ...shadow },
  dirText: { flex: 1, fontSize: font.body, fontWeight: '800', color: colors.ink },
  controls: { position: 'absolute', right: SCREEN, gap: 10, alignItems: 'flex-end' },

  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: SCREEN, ...shadow },
  handleHit: { alignItems: 'center', paddingVertical: 8 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.separator },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.sm },
  panelTitle: { fontSize: font.h2, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  panelSub: { fontSize: font.small, color: colors.muted, marginTop: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: font.tiny, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: space.sm, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.bg, borderRadius: radius.lg, padding: space.md, minHeight: 60 },
  rowPressed: { backgroundColor: colors.forest50 },
  rowTitle: { fontSize: font.body, fontWeight: '700', color: colors.ink },
  rowSub: { fontSize: font.tiny, color: colors.muted, marginTop: 2 },
  big: { fontSize: 24, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'], letterSpacing: -0.6 },
  unit: { fontSize: 11, color: colors.muted, fontWeight: '700', marginTop: -2 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.forest100, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live },
  liveText: { fontSize: 11, fontWeight: '800', color: colors.forest700, textTransform: 'uppercase' },
  actions: { flexDirection: 'row', gap: space.sm, marginBottom: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, height: 38, backgroundColor: colors.forest100 },
  actionPrimary: { backgroundColor: colors.forest700 },
  actionText: { fontSize: font.small, fontWeight: '700', color: colors.forest700 },
  yours: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.forest100, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  yoursText: { flex: 1, fontSize: font.small, color: colors.forest800 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 9 },
  stopDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, backgroundColor: colors.white },
  stopName: { flex: 1, fontSize: font.body, color: colors.ink, fontWeight: '500' },
  stopTime: { fontSize: font.small, color: colors.inkSoft, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { fontSize: font.small, color: colors.muted, paddingVertical: space.md, textAlign: 'center' },
});
