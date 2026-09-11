import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavBar, Group, Muted, PrimaryButton, GhostButton, Loading, ErrorRow, EmptyState, Separator, SectionHeading, Chip } from '../../src/components/ui';
import { BookingStatusPill } from '../../src/components/StatusPill';
import { QrScanner } from '../../src/staff/QrScanner';
import { useAdapter, useAppMode } from '../../src/data/AdapterProvider';
import { useAsync, humanError } from '../../src/hooks/useAsync';
import { useToast } from '../../src/components/ToastProvider';
import { haptics } from '../../src/lib/feedback';
import { colors, radius, space, font, SCREEN, control } from '../../src/theme';
import { formatTime } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import type { ManifestRow, BookingView } from '@shared/data/adapter';

export default function ConductorWorkspace() {
  const { staff } = useLocalSearchParams<{ staff: string }>();
  const adapter = useAdapter();
  const mode = useAppMode();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [tripId, setTripId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [pending, setPending] = useState<BookingView | null>(null);

  const trips = useAsync(() => adapter.staffTrips(String(staff)), [staff, tick]);
  const list = trips.data ?? [];
  const active = list.find((t) => t.id === tripId) ?? list[0];
  const manifest = useAsync(() => (active ? adapter.getTripManifest(active.id) : Promise.resolve([])), [active?.id, tick]);

  const stops = useMemo(() => (active ? [...active.stops].sort((a, b) => a.stopOrder - b.stopOrder) : []), [active]);
  const hubName = (id: string) => stops.find((s) => s.hubId === id)?.hubName ?? 'Hub';

  const rows = manifest.data ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.passengerName.toLowerCase().includes(q) || r.reference.toLowerCase().includes(q));
  }, [rows, query]);

  // Group by pickup hub, ordered by stop order.
  const groups = useMemo(() => {
    const byHub = new Map<string, ManifestRow[]>();
    for (const r of filtered) {
      const arr = byHub.get(r.pickupHubId) ?? [];
      arr.push(r); byHub.set(r.pickupHubId, arr);
    }
    return stops
      .map((s) => ({ hubId: s.hubId, name: s.hubName, rows: (byHub.get(s.hubId) ?? []).sort((a, b) => a.passengerName.localeCompare(b.passengerName)) }))
      .filter((g) => g.rows.length > 0);
  }, [filtered, stops]);

  async function reload() { setTick((n) => n + 1); }

  // Resolve a scanned/entered code to a passenger WITHOUT boarding, then confirm.
  async function onCode(raw: string) {
    setScanOpen(false);
    if (!active || busy) return;
    const cred = raw.replace(/^TOGO:/i, '').trim();
    if (!cred) return;
    if (mode === 'demo') {
      try {
        const b = await adapter.resolveBoarding(active.id, cred);
        haptics.select();
        setPending(b);
      } catch (e) { haptics.warning(); toast(humanError(e), 'error'); }
    } else {
      // Connected: no read-only resolve yet — confirm by code, then board server-side.
      Alert.alert('Board passenger', `Board the passenger with code ${cred}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Board', onPress: () => board(active.id, cred) },
      ]);
    }
  }

  async function board(id: string, cred: string) {
    if (busy) return;
    setBusy(true);
    try {
      const b = await adapter.boardByCredential(id, cred);
      haptics.success();
      toast(`Boarded ${b.passengerName} (${b.seats})`, 'ok');
      setPending(null); setCode('');
      reload();
    } catch (e) { haptics.warning(); toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }

  function departHub(hubId: string, name: string, rowsAtHub: ManifestRow[]) {
    const stranded = rowsAtHub.filter((r) => r.status === 'checked_in');
    const seats = stranded.reduce((n, r) => n + r.seats, 0);
    if (stranded.length === 0) { toast(`No checked-in passengers waiting at ${name}.`, 'ok'); return; }
    Alert.alert(
      `Leave ${name}?`,
      `${seats} checked-in passenger${seats === 1 ? '' : 's'} ${seats === 1 ? 'is' : 'are'} not yet boarded. Departing records a missed-pickup investigation for them. Choose a reason:`,
      [
        { text: 'Keep waiting', style: 'cancel' },
        { text: 'Not present', onPress: () => override(hubId, 'Passenger not present at departure') },
        { text: 'Arrived late', onPress: () => override(hubId, 'Passenger arrived after departure') },
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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NavBar title="Conductor" onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        {trips.loading && <Loading />}
        {trips.error && <ErrorRow message={trips.error} onRetry={reload} />}
        {!trips.loading && list.length === 0 && (
          <EmptyState title="No trips assigned today">This conductor has no departures scheduled for today.</EmptyState>
        )}

        {list.length > 1 && (
          <View style={styles.tripChips}>
            {list.map((t) => (
              <Chip key={t.id} label={formatTime(t.originDeparture)} selected={active?.id === t.id} onPress={() => setTripId(t.id)} />
            ))}
          </View>
        )}

        {active && cities && (
          <>
            <View style={styles.hero}>
              <Text style={styles.route}>{cities.origin} → {cities.destination}</Text>
              <Text style={styles.sub}>{active.operatorName} · departs {formatTime(active.originDeparture)}</Text>
            </View>

            {/* Board panel */}
            <SectionHeading title="Board a passenger" />
            <Group style={{ padding: space.lg, gap: space.sm }}>
              <PrimaryButton title="Scan boarding QR" onPress={() => setScanOpen(true)} />
              <View style={styles.codeRow}>
                <TextInput
                  style={styles.codeInput}
                  value={code}
                  onChangeText={setCode}
                  placeholder="Enter boarding code"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  keyboardType="number-pad"
                  accessibilityLabel="Boarding code"
                />
                <GhostButton title="Find" onPress={() => code.trim() && onCode(code)} />
              </View>
              <Muted style={{ fontSize: font.tiny }}>Scanning never boards on its own — you confirm each passenger first.</Muted>
            </Group>

            {/* Search */}
            <SectionHeading title="Manifest" />
            <View style={styles.search}>
              <Ionicons name="search" size={16} color={colors.muted} />
              <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search name or reference" placeholderTextColor={colors.muted} accessibilityLabel="Search manifest" />
              {query.length > 0 && <Pressable onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable>}
            </View>

            {manifest.loading && <Loading />}
            {!manifest.loading && rows.length === 0 && (
              <Group style={{ padding: space.lg }}><Muted style={{ fontSize: font.small }}>No reservations on this trip yet.</Muted></Group>
            )}
            {groups.map((g) => {
              const stranded = g.rows.filter((r) => r.status === 'checked_in').reduce((n, r) => n + r.seats, 0);
              return (
                <View key={g.hubId} style={{ marginBottom: space.md }}>
                  <View style={styles.groupHead}>
                    <Text style={styles.groupName}>{g.name}</Text>
                    {stranded > 0 && <Text style={styles.strandTag}>{stranded} waiting</Text>}
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
                  <Pressable onPress={() => departHub(g.hubId, g.name, g.rows)} accessibilityRole="button" style={styles.departLink}>
                    <Ionicons name="exit-outline" size={15} color={colors.forest700} />
                    <Text style={styles.departText}>Depart {g.name}</Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Confirm-before-board card (preview resolve) */}
      {pending && active && (
        <View style={[styles.confirmWrap, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmKicker}>Confirm boarding</Text>
            <Text style={styles.confirmName}>{pending.passengerName}</Text>
            <Text style={styles.confirmMeta}>{pending.reference} · {pending.seats} passenger{pending.seats === 1 ? '' : 's'} · {hubName(pending.pickupHubId)}</Text>
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
              <GhostButton title="Cancel" onPress={() => setPending(null)} style={{ flex: 1 }} />
              <View style={{ flex: 1 }}>
                <PrimaryButton title={`Board ${pending.seats}`} onPress={() => board(active.id, pending.boardingCredential)} loading={busy} />
              </View>
            </View>
          </View>
        </View>
      )}

      <QrScanner visible={scanOpen} onClose={() => setScanOpen(false)} onCode={onCode} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tripChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.sm },
  hero: { marginTop: space.sm, marginBottom: space.xs },
  route: { fontSize: font.h2, fontWeight: '700', color: colors.ink },
  sub: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  codeInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, minHeight: control.height, fontSize: font.body, color: colors.ink, backgroundColor: colors.surface, letterSpacing: 2 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, paddingHorizontal: 12, minHeight: control.small, marginBottom: space.sm },
  searchInput: { flex: 1, fontSize: font.body, color: colors.ink, paddingVertical: 10 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs, paddingHorizontal: space.xs },
  groupName: { fontSize: font.small, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.muted },
  strandTag: { fontSize: font.tiny, fontWeight: '700', color: colors.amber800 },
  paxRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 12 },
  paxName: { fontSize: font.body, fontWeight: '600', color: colors.ink },
  paxMeta: { fontSize: font.small, color: colors.muted, marginTop: 1 },
  departLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: space.xs, marginTop: 2 },
  departText: { color: colors.forest700, fontWeight: '600', fontSize: font.small },
  confirmWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: SCREEN },
  confirmCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, ...{ shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -2 }, elevation: 12 } },
  confirmKicker: { color: colors.forest700, fontSize: font.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  confirmName: { color: colors.ink, fontSize: font.h2, fontWeight: '700', marginTop: 2 },
  confirmMeta: { color: colors.muted, fontSize: font.small, marginTop: 2 },
});
