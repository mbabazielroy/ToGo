import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavBar, Group, Muted, PrimaryButton, GhostButton, Loading, ErrorRow, EmptyState, Separator, SectionHeading, Chip } from '../../src/components/ui';
import { TripStatusPill } from '../../src/components/StatusPill';
import { useAdapter, useAppMode } from '../../src/data/AdapterProvider';
import { useAsync, humanError } from '../../src/hooks/useAsync';
import { useToast } from '../../src/components/ToastProvider';
import { haptics } from '../../src/lib/feedback';
import { colors, radius, space, font, SCREEN } from '../../src/theme';
import { formatTime } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import { manifestCounts } from '../../src/staff/counts';

export default function DriverWorkspace() {
  const { staff } = useLocalSearchParams<{ staff: string }>();
  const adapter = useAdapter();
  const mode = useAppMode();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [tripId, setTripId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const trips = useAsync(() => adapter.staffTrips(String(staff)), [staff, tick]);
  const list = trips.data ?? [];
  const active = list.find((t) => t.id === tripId) ?? list[0];
  const manifest = useAsync(() => (active ? adapter.getTripManifest(active.id) : Promise.resolve([])), [active?.id, tick]);
  const counts = useMemo(() => manifestCounts(manifest.data ?? []), [manifest.data]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    if (busy) return;
    setBusy(true);
    try { await fn(); haptics.success(); toast(ok, 'ok'); setTick((n) => n + 1); }
    catch (e) { haptics.warning(); toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }

  const stops = active ? [...active.stops].sort((a, b) => a.stopOrder - b.stopOrder) : [];
  const nextStop = stops.find((s) => !s.reached);
  const cities = active ? DIRECTION_CITIES[active.direction] : null;
  const running = active && (active.status === 'en_route' || active.status === 'boarding');
  const finished = active && (active.status === 'completed' || active.status === 'cancelled');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NavBar title="Driver" onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: insets.bottom + space.xxl }}>
        {trips.loading && <Loading />}
        {trips.error && <ErrorRow message={trips.error} onRetry={() => setTick((n) => n + 1)} />}
        {!trips.loading && list.length === 0 && (
          <EmptyState title="No trips assigned today">This driver has no departures scheduled for today.</EmptyState>
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
              <View style={{ flex: 1 }}>
                <Text style={styles.route}>{cities.origin} → {cities.destination}</Text>
                <Text style={styles.sub}>{active.operatorName}{active.vehicleLabel ? ` · ${active.vehicleLabel}` : ''}</Text>
              </View>
              <TripStatusPill status={active.status} delayed={active.delayMinutes > 0} />
            </View>

            <Group style={{ paddingHorizontal: space.lg }}>
              <Row label="Departs origin" value={formatTime(active.originDeparture)} />
              <Separator />
              <Row label="Conductor" value={active.conductorName ?? 'Unassigned'} />
              <Separator />
              <Row label="Next pickup" value={nextStop ? `${nextStop.hubName} · ${formatTime(nextStop.pickupTime)}` : 'All hubs reached'} />
            </Group>

            <SectionHeading title="Passengers" />
            {manifest.loading ? <Loading /> : (
              <Group style={{ paddingHorizontal: space.lg }}>
                <View style={styles.countsRow}>
                  <Count label="Expected" value={counts.expected} />
                  <Count label="Checked in" value={counts.checkedIn} />
                  <Count label="Boarded" value={counts.boarded} tone={colors.forest700} />
                </View>
                <Muted style={{ fontSize: font.tiny }}>Passenger counts (seats). Boarding is handled by the conductor.</Muted>
              </Group>
            )}

            <SectionHeading title="Trip controls" />
            <Muted style={{ fontSize: font.tiny, marginBottom: space.sm }}>Intended for use while stopped.</Muted>
            <View style={{ gap: space.sm }}>
              {active.status === 'scheduled' && (
                <PrimaryButton title="Start trip" onPress={() => act(() => adapter.updateTripStatus(active.id, 'en_route'), 'Trip started.')} loading={busy} />
              )}
              {running && nextStop && (
                <PrimaryButton title={`Reach ${nextStop.hubName}`} onPress={() => act(() => adapter.reachHub(active.id, nextStop.hubId), `Reached ${nextStop.hubName}.`)} loading={busy} />
              )}
              {running && !nextStop && (
                <PrimaryButton title="Complete trip" onPress={() => confirm('Complete trip', 'Mark this trip completed?', () => act(() => adapter.updateTripStatus(active.id, 'completed'), 'Trip completed.'))} loading={busy} />
              )}
              {!finished && (
                <View style={styles.secRow}>
                  <GhostButton title="Report delay +15m" onPress={() => act(() => adapter.reportDelay(active.id, 15), 'Delay reported.')} style={{ flex: 1 }} />
                  <GhostButton title="Report breakdown" danger onPress={() => confirm('Report breakdown', 'This cancels the trip and releases seats. Passengers are notified.', () => act(() => adapter.cancelTrip(active.id, 'Vehicle breakdown reported by driver'), 'Breakdown reported.'))} style={{ flex: 1 }} />
                </View>
              )}
              {running && nextStop && (
                <GhostButton title="Complete trip" onPress={() => confirm('Complete trip', 'End the trip now? Remaining hubs will be skipped.', () => act(() => adapter.updateTripStatus(active.id, 'completed'), 'Trip completed.'))} />
              )}
            </View>

            <SectionHeading title="Location sharing" />
            <Group style={{ padding: space.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name={mode === 'demo' ? 'navigate-circle-outline' : 'navigate'} size={18} color={colors.forest700} />
                <Text style={styles.locTitle}>{mode === 'demo' ? 'Simulated (preview)' : (running ? 'Sharing while the app is open' : 'Off — trip not running')}</Text>
              </View>
              <Muted style={{ fontSize: font.small, marginTop: 4 }}>
                {mode === 'demo'
                  ? 'Location is simulated in preview — no real GPS is used.'
                  : 'Live location is shared only while this screen is open and the trip is running. There is no background tracking.'}
              </Muted>
            </Group>
          </>
        )}
      </ScrollView>
    </View>
  );

  function confirm(title: string, message: string, onYes: () => void) {
    Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', style: 'destructive', onPress: onYes }]);
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue} numberOfLines={1}>{value}</Text>
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
  tripChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.sm },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, marginBottom: space.xs },
  route: { fontSize: font.h2, fontWeight: '700', color: colors.ink },
  sub: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, paddingVertical: 6, gap: 12 },
  kvLabel: { fontSize: font.body, color: colors.inkSoft },
  kvValue: { fontSize: font.body, color: colors.ink, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  countsRow: { flexDirection: 'row', paddingVertical: space.xs },
  count: { flex: 1, alignItems: 'center' },
  countValue: { fontSize: 28, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  countLabel: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  secRow: { flexDirection: 'row', gap: space.sm },
  locTitle: { fontSize: font.body, fontWeight: '600', color: colors.ink },
});
