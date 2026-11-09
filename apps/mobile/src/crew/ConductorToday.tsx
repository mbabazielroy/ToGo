import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Group, PrimaryButton, GhostButton, Loading, ErrorRow, EmptyState, Separator, Banner } from '@/components/ui';
import { BookingStatusPill } from '@/components/StatusPill';
import { QrScanner } from '@/staff/QrScanner';
import { useAdapter, useDataEpoch } from '@/data/AdapterProvider';
import { useAsync, humanError } from '@/hooks/useAsync';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { useToast } from '@/components/ToastProvider';
import { haptics } from '@/lib/feedback';
import { radius, space, font, SCREEN, control, useColors, makeStyles } from '@/theme';
import { formatTime } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import type { ManifestRow, BookingView } from '@shared/data/adapter';
import { manifestCounts } from '@/staff/counts';
import { CrewHeader, HeaderStat } from './CrewHeader';
import { TripPicker } from './TripPicker';
import { pickActiveTrip } from './activeTrip';
import { ask } from '@/lib/dialog';

type Filter = 'all' | 'waiting' | 'boarded';

export function ConductorToday({ staffId, tripParam }: { staffId: string; tripParam?: string }) {
  const colors = useColors();
  const styles = useStyles();
  const adapter = useAdapter();
  const epoch = useDataEpoch();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [tripId, setTripId] = useState<string | undefined>(tripParam);
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [pending, setPending] = useState<BookingView | null>(null);

  const trips = useAsync(() => adapter.staffTrips(staffId), [staffId, tick, epoch]);
  useLiveRefresh(() => setTick((n) => n + 1));
  const list = trips.data ?? [];
  const active = pickActiveTrip(list, tripId ?? tripParam);
  const manifest = useAsync(() => (active ? adapter.getTripManifest(active.id) : Promise.resolve([])), [active?.id, tick, epoch]);
  const rows = useMemo(() => manifest.data ?? [], [manifest.data]);
  const counts = useMemo(() => manifestCounts(rows), [rows]);

  const stops = useMemo(() => (active ? [...active.stops].sort((a, b) => a.stopOrder - b.stopOrder) : []), [active]);
  const hubName = (id: string) => stops.find((s) => s.hubId === id)?.hubName ?? 'Hub';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (filter === 'waiting' ? r.status === 'reserved' || r.status === 'checked_in' : filter === 'boarded' ? r.status === 'boarded' || r.status === 'completed' : true))
      .filter((r) => !q || r.passengerName.toLowerCase().includes(q) || r.reference.toLowerCase().includes(q));
  }, [rows, query, filter]);

  const groups = useMemo(() => {
    const byHub = new Map<string, ManifestRow[]>();
    for (const r of filtered) byHub.set(r.pickupHubId, [...(byHub.get(r.pickupHubId) ?? []), r]);
    return stops
      .map((s) => ({ hubId: s.hubId, name: s.hubName, time: s.pickupTime, reached: s.reached, rows: (byHub.get(s.hubId) ?? []).sort((a, b) => a.passengerName.localeCompare(b.passengerName)) }))
      .filter((g) => g.rows.length > 0);
  }, [filtered, stops]);

  const reload = () => setTick((n) => n + 1);

  // Resolve a scanned/entered code to a passenger WITHOUT boarding, then confirm.
  async function onCode(raw: string) {
    setScanOpen(false);
    if (!active || busy) return;
    const cred = raw.replace(/^TOGO:/i, '').trim();
    if (!cred) return;
    try {
      const b = await adapter.resolveBoarding(active.id, cred);
      haptics.select();
      setPending(b);
    } catch (e) { haptics.warning(); toast(humanError(e), 'error'); }
  }

  async function board(id: string, cred: string) {
    if (busy) return;
    setBusy(true);
    try {
      const b = await adapter.boardByCredential(id, cred);
      haptics.success();
      toast(`${b.passengerName} boarded · ${b.seats} seat${b.seats === 1 ? '' : 's'}`, 'ok');
      setPending(null); setCode('');
      reload();
    } catch (e) { haptics.warning(); toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }

  function departHub(hubId: string, name: string, rowsAtHub: ManifestRow[]) {
    const stranded = rowsAtHub.filter((r) => r.status === 'checked_in');
    const seats = stranded.reduce((n, r) => n + r.seats, 0);
    if (stranded.length === 0) { toast(`Everyone checked in at ${name} is on board.`, 'ok'); return; }
    ask(
      `Leave ${name}?`,
      `${seats} checked-in passenger${seats === 1 ? ' is' : 's are'} not on board. Leaving records a missed pickup for operations to follow up. Why are you leaving?`,
      [
        { text: 'Keep waiting', style: 'cancel' },
        { text: 'Not at the hub', onPress: () => override(hubId, 'Passenger not present at departure') },
        { text: 'Arrived too late', onPress: () => override(hubId, 'Passenger arrived after departure') },
      ],
    );
  }
  async function override(hubId: string, reason: string) {
    if (!active || busy) return;
    setBusy(true);
    try {
      const n = await adapter.recordUnresolvedPickup(active.id, hubId, reason);
      haptics.warning();
      toast(`Recorded ${n} missed pickup${n === 1 ? '' : 's'}.`, 'ok');
      reload();
    } catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }

  const cities = active ? DIRECTION_CITIES[active.direction] : null;
  const closed = !!active && (active.status === 'completed' || active.status === 'cancelled');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <CrewHeader>
        <TripPicker trips={list} activeId={active?.id} onSelect={setTripId} />
        {active && cities && (
          <>
            <Text style={styles.headerRoute}>{cities.origin} → {cities.destination} · {formatTime(active.originDeparture)}{active.delayMinutes > 0 ? `  ·  +${active.delayMinutes} min` : ''}</Text>
            <View style={styles.headerStats}>
              <HeaderStat label="Booked" value={counts.expected} />
              <HeaderStat label="Checked in" value={counts.checkedIn} />
              <HeaderStat label="On board" value={counts.boarded} tone={colors.live} />
            </View>
            {!closed && (
              <Pressable onPress={() => setScanOpen(true)} accessibilityRole="button" style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.9 }]}>
                <Ionicons name="scan" size={22} color={colors.forest900} />
                <Text style={styles.scanText}>Scan boarding pass</Text>
              </Pressable>
            )}
          </>
        )}
      </CrewHeader>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SCREEN, paddingBottom: insets.bottom + space.xxl * 3, gap: space.md }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.forest700} />}>
        {trips.loading && !trips.data && <Loading />}
        {trips.error && <ErrorRow message={trips.error} onRetry={reload} />}
        {!trips.loading && list.length === 0 && (
          <EmptyState title="No trips assigned today">When operations assigns you to a departure, its passenger list shows up here.</EmptyState>
        )}

        {active && (
          <>
            {closed && <Banner tone={active.status === 'cancelled' ? 'error' : 'ok'} title={active.status === 'cancelled' ? 'This trip was cancelled' : 'Trip complete'}>Boarding is closed for this departure.</Banner>}
            {!closed && (
              <Group style={{ padding: space.md }}>
                <Text style={styles.manualLabel}>No QR? Enter the 4-digit boarding code</Text>
                <View style={styles.codeRow}>
                  <TextInput style={styles.codeInput} value={code} onChangeText={(v) => setCode(v.replace(/[^0-9A-Za-z-]/g, ''))} placeholder="0000" placeholderTextColor={colors.faint}
                    keyboardType="number-pad" maxLength={12} accessibilityLabel="Boarding code" returnKeyType="search" onSubmitEditing={() => code.trim() && onCode(code)} />
                  <View style={{ width: 92 }}><PrimaryButton title="Find" onPress={() => code.trim() && onCode(code)} disabled={!code.trim()} /></View>
                </View>
              </Group>
            )}

            <View style={styles.search}>
              <Ionicons name="search" size={16} color={colors.muted} />
              <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search name or reference" placeholderTextColor={colors.muted} accessibilityLabel="Search passengers" />
              {query.length > 0 && <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable>}
            </View>
            <View style={styles.filters}>
              {(['all', 'waiting', 'boarded'] as Filter[]).map((f) => (
                <Pressable key={f} onPress={() => setFilter(f)} accessibilityRole="button" accessibilityState={{ selected: filter === f }} style={[styles.filter, filter === f && styles.filterOn]}>
                  <Text style={[styles.filterText, filter === f && styles.filterTextOn]}>{f === 'all' ? 'All' : f === 'waiting' ? 'Not boarded' : 'On board'}</Text>
                </Pressable>
              ))}
            </View>

            {manifest.loading && !manifest.data && <Loading />}
            {!manifest.loading && rows.length === 0 && <EmptyState title="No reservations yet">Passengers appear here as they book.</EmptyState>}
            {rows.length > 0 && groups.length === 0 && <Text style={styles.none}>No passengers match.</Text>}

            {groups.map((g) => {
              const stranded = g.rows.filter((r) => r.status === 'checked_in').reduce((n, r) => n + r.seats, 0);
              return (
                <View key={g.hubId}>
                  <View style={styles.groupHead}>
                    <Text style={styles.groupName}>{g.name}</Text>
                    <Text style={styles.groupTime}>{formatTime(g.time)}</Text>
                    {stranded > 0 && <View style={styles.waitTag}><Text style={styles.waitText}>{stranded} waiting</Text></View>}
                  </View>
                  <Group style={{ paddingHorizontal: space.md }}>
                    {g.rows.map((r, i) => (
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
                  {!closed && (
                    <Pressable onPress={() => departHub(g.hubId, g.name, g.rows)} accessibilityRole="button" style={styles.departLink}>
                      <Ionicons name="exit-outline" size={15} color={colors.forest700} />
                      <Text style={styles.departText}>Leave {g.name}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Confirm before boarding — scanning never boards on its own. */}
      {pending && active && (
        <View style={[styles.confirmWrap, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.confirmCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark-circle" size={20} color={colors.forest600} />
              <Text style={styles.confirmKicker}>Valid boarding pass</Text>
            </View>
            <Text style={styles.confirmName}>{pending.passengerName}</Text>
            <Text style={styles.confirmMeta}>{pending.reference} · {pending.seats} passenger{pending.seats === 1 ? '' : 's'} · from {hubName(pending.pickupHubId)}</Text>
            <Text style={styles.confirmPay}>Collect {pending.seats > 1 ? `${pending.seats} × ` : ''}UGX {pending.fareUgxSnapshot.toLocaleString('en-US')} at boarding</Text>
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
              <GhostButton title="Cancel" onPress={() => setPending(null)} style={{ flex: 1 }} />
              <View style={{ flex: 2 }}>
                <PrimaryButton title={`Board ${pending.seats}`} icon="checkmark" onPress={() => board(active.id, pending.boardingCredential)} loading={busy} />
              </View>
            </View>
          </View>
        </View>
      )}

      <QrScanner visible={scanOpen} onClose={() => setScanOpen(false)} onCode={onCode} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  headerRoute: { color: colors.onDarkSoft, fontSize: font.small, fontWeight: '600' },
  headerStats: { flexDirection: 'row', gap: space.md },
  scanBtn: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.live, borderRadius: radius.xl, minHeight: control.height + 6 },
  scanText: { color: colors.forest900, fontSize: font.body, fontWeight: '800' },
  manualLabel: { fontSize: font.tiny, color: colors.muted, fontWeight: '600', marginBottom: space.sm },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  codeInput: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, minHeight: control.height, fontSize: 22, fontWeight: '700', color: colors.ink, letterSpacing: 6, fontVariant: ['tabular-nums'] },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 12, minHeight: control.small },
  searchInput: { flex: 1, fontSize: font.body, color: colors.ink, paddingVertical: 10 },
  filters: { flexDirection: 'row', gap: 6 },
  filter: { borderRadius: 999, paddingHorizontal: 12, height: 32, justifyContent: 'center', backgroundColor: colors.surface },
  filterOn: { backgroundColor: colors.inverse },
  filterText: { fontSize: font.tiny, fontWeight: '700', color: colors.inkSoft },
  filterTextOn: { color: colors.onInverse },
  none: { textAlign: 'center', color: colors.muted, fontSize: font.small, paddingVertical: space.lg },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.xs, paddingHorizontal: space.xs },
  groupName: { fontSize: font.small, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  groupTime: { fontSize: font.tiny, color: colors.muted, fontWeight: '600', flex: 1 },
  waitTag: { backgroundColor: colors.amber100, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  waitText: { fontSize: 11, fontWeight: '800', color: colors.amber800 },
  paxRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 12 },
  paxName: { fontSize: font.body, fontWeight: '600', color: colors.ink },
  paxMeta: { fontSize: font.small, color: colors.muted, marginTop: 1 },
  departLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: space.xs, minHeight: 40 },
  departText: { color: colors.forest700, fontWeight: '600', fontSize: font.small },
  confirmWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: SCREEN },
  confirmCard: { backgroundColor: colors.surface, borderRadius: radius.xxl, padding: space.lg, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: -2 }, elevation: 14 },
  confirmKicker: { color: colors.forest700, fontSize: font.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  confirmName: { color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 6 },
  confirmMeta: { color: colors.muted, fontSize: font.small, marginTop: 2 },
  confirmPay: { color: colors.inkSoft, fontSize: font.small, fontWeight: '600', marginTop: space.sm },
}));
