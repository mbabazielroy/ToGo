import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card, H1, Muted, Label, PrimaryButton, Loading, ErrorRow, SectionHeading, EmptyState } from '../../src/components/ui';
import { TripStatusPill, BookingStatusPill } from '../../src/components/StatusPill';
import { useAdapter, useDataEpoch } from '../../src/data/AdapterProvider';
import { useSearch } from '../../src/state/search';
import { useAsync } from '../../src/hooks/useAsync';
import { colors, radius, space, font } from '../../src/theme';
import { addDays, kampalaToday, formatDate, formatTime, formatUGX } from '@shared/lib/time';
import type { BookingView } from '@shared/data/adapter';

export default function Home() {
  const adapter = useAdapter();
  const router = useRouter();
  const epoch = useDataEpoch();
  const { criteria, set, toggleDirection } = useSearch();

  const originCity = criteria.direction === 'KLA_MBR' ? 'Kampala' : 'Mbarara';
  const destCity = criteria.direction === 'KLA_MBR' ? 'Mbarara' : 'Kampala';

  const hubs = useAsync(() => adapter.listHubs(), [epoch]);
  const trips = useAsync(() => adapter.searchTrips(criteria), [criteria.direction, criteria.date, criteria.hubId, epoch]);
  const bookings = useAsync(() => adapter.myBookings(), [epoch]);

  const originHubs = useMemo(() => (hubs.data ?? []).filter((h) => h.city === originCity), [hubs.data, originCity]);
  const upcoming = (bookings.data ?? []).filter((b) => ['reserved', 'checked_in', 'boarded'].includes(b.status));
  const days = [0, 1, 2].map((d) => addDays(kampalaToday(), d));

  return (
    <Screen subtitle="Your bus. Your stop.">
      <H1>Find your hub. Meet your bus.</H1>
      <Muted>Reserve a seat, check in at a pickup hub, and board with a code.</Muted>

      {upcoming.length > 0 && <UpcomingCard booking={upcoming[0]} onPress={() => router.push(`/trip/${upcoming[0].id}`)} />}

      <Card style={{ gap: space.md }}>
        {/* Direction */}
        <View style={styles.dirRow}>
          <View style={{ flex: 1 }}><Label>From</Label><Text style={styles.city}>{originCity}</Text></View>
          <Pressable onPress={toggleDirection} accessibilityLabel="Switch direction" style={styles.swap}>
            <Ionicons name="swap-horizontal" size={20} color={colors.forest700} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'flex-end' }}><Label>To</Label><Text style={styles.city}>{destCity}</Text></View>
        </View>

        {/* Date chips */}
        <View>
          <Label>Date</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {days.map((d, i) => {
              const active = criteria.date === d;
              return (
                <Pressable key={d} onPress={() => set({ date: d })} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatDate(d)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Passengers */}
        <View>
          <Label>Passengers</Label>
          <View style={styles.stepper}>
            <Pressable onPress={() => set({ passengers: Math.max(1, criteria.passengers - 1) })} style={styles.stepBtn}><Text style={styles.stepSign}>−</Text></Pressable>
            <Text style={styles.stepVal}>{criteria.passengers}</Text>
            <Pressable onPress={() => set({ passengers: Math.min(5, criteria.passengers + 1) })} style={styles.stepBtn}><Text style={styles.stepSign}>+</Text></Pressable>
          </View>
        </View>

        {/* Hub */}
        <View>
          <Label>Pickup hub</Label>
          {hubs.loading ? <Loading /> : hubs.error ? <ErrorRow message={hubs.error} onRetry={hubs.reload} /> : (
            <View style={{ gap: 8 }}>
              <Pressable onPress={() => set({ hubId: null })} style={[styles.hub, !criteria.hubId && styles.hubActive]}>
                <Text style={styles.hubName}>Any hub</Text>
              </Pressable>
              {originHubs.map((h) => (
                <Pressable key={h.id} onPress={() => set({ hubId: h.id })} style={[styles.hub, criteria.hubId === h.id && styles.hubActive]}>
                  <Text style={styles.hubName}>{h.name}</Text>
                  <Text style={styles.hubArea}>{h.area}</Text>
                </Pressable>
              ))}
              {originHubs.length === 0 && <Muted>No approved hubs in this city yet.</Muted>}
            </View>
          )}
        </View>
      </Card>

      <SectionHeading title="Departures" />
      {trips.loading && <Loading />}
      {trips.error && <ErrorRow message={trips.error} onRetry={trips.reload} />}
      {trips.data && trips.data.length === 0 && <EmptyState title="No departures match">Try another day, switch direction, or clear the hub.</EmptyState>}
      {trips.data?.map((t) => {
        const stops = [...t.stops].sort((a, b) => a.stopOrder - b.stopOrder);
        const pickup = stops.find((s) => s.hubId === criteria.hubId) ?? stops[0];
        const enough = t.seatsAvailable >= criteria.passengers;
        return (
          <Card key={t.id} style={{ padding: 0, overflow: 'hidden' }}>
            <View style={styles.depHead}>
              <View>
                <Text style={styles.op}>{t.operatorName}</Text>
                <Text style={styles.vehicle}>{t.vehicleLabel ?? ''}</Text>
              </View>
              <TripStatusPill status={t.status} delayed={t.delayMinutes > 0} />
            </View>
            <View style={styles.times}>
              <TimeCol label="Departs origin" time={formatTime(t.originDeparture)} />
              <TimeCol label="Your pickup" time={pickup ? formatTime(pickup.pickupTime) : '—'} sub={pickup?.hubName} highlight />
              <TimeCol label="Arrives" time={formatTime(t.destinationArrival)} />
            </View>
            <View style={styles.depFoot}>
              <Text style={[styles.seats, !enough && { color: colors.red700, fontWeight: '800' }]}>
                {t.seatsAvailable} seat{t.seatsAvailable === 1 ? '' : 's'} left
              </Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.fare}>{formatUGX(t.fareUgx)}</Text>
                <Text style={styles.perPax}>per passenger</Text>
              </View>
              {enough ? (
                <Pressable onPress={() => router.push(`/book/${t.id}?hub=${pickup?.hubId ?? ''}&pax=${criteria.passengers}`)} style={styles.selectBtn}>
                  <Text style={styles.selectText}>Select</Text>
                </Pressable>
              ) : (
                <View style={[styles.selectBtn, { backgroundColor: colors.sand200 }]}><Text style={[styles.selectText, { color: colors.forest500 }]}>Full</Text></View>
              )}
            </View>
          </Card>
        );
      })}
      <Muted style={{ textAlign: 'center', fontSize: font.tiny, marginTop: space.sm }}>
        Origin departure differs from your hub pickup time. Times in Africa/Kampala.
      </Muted>
    </Screen>
  );
}

function TimeCol({ label, time, sub, highlight }: { label: string; time: string; sub?: string; highlight?: boolean }) {
  return (
    <View style={[styles.timeCol, highlight && { backgroundColor: colors.lime50, borderRadius: radius.md }]}>
      <Text style={styles.timeVal}>{time}</Text>
      <Text style={styles.timeLabel}>{label}</Text>
      {sub ? <Text style={styles.timeSub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

function UpcomingCard({ booking, onPress }: { booking: BookingView; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.upcoming}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.upLabel}>Your upcoming trip</Text>
        <BookingStatusPill status={booking.status} />
      </View>
      <Text style={styles.upRef}>{booking.reference}</Text>
      <Text style={styles.upMeta}>{booking.seats} seat{booking.seats === 1 ? '' : 's'} · pickup {formatTime(booking.pickupTimeSnapshot)} · {formatUGX(booking.fareUgxSnapshot * booking.seats)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dirRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  city: { fontSize: font.h2, fontWeight: '800', color: colors.forest900 },
  swap: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.forest200, backgroundColor: colors.forest50, alignItems: 'center', justifyContent: 'center' },
  chip: { flex: 1, borderWidth: 1, borderColor: colors.forest200, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  chipActive: { borderColor: colors.forest600, backgroundColor: colors.forest50 },
  chipText: { color: colors.forest600, fontWeight: '700', fontSize: font.small },
  chipTextActive: { color: colors.forest800 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.forest200, borderRadius: radius.md, padding: 4 },
  stepBtn: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.forest50, alignItems: 'center', justifyContent: 'center' },
  stepSign: { fontSize: 22, fontWeight: '800', color: colors.forest700 },
  stepVal: { width: 28, textAlign: 'center', fontSize: font.h2, fontWeight: '800', color: colors.forest900 },
  hub: { borderWidth: 1, borderColor: colors.forest200, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  hubActive: { borderColor: colors.forest600, backgroundColor: colors.forest50 },
  hubName: { fontWeight: '700', color: colors.forest900, fontSize: font.body },
  hubArea: { color: colors.muted, fontSize: font.small },
  depHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.md, borderBottomWidth: 1, borderBottomColor: colors.forest50 },
  op: { fontWeight: '800', color: colors.forest900, fontSize: font.body },
  vehicle: { color: colors.muted, fontSize: font.tiny },
  times: { flexDirection: 'row', padding: space.md, gap: 4 },
  timeCol: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  timeVal: { fontSize: font.title, fontWeight: '800', color: colors.forest800 },
  timeLabel: { fontSize: font.tiny, color: colors.forest500, textTransform: 'uppercase' },
  timeSub: { fontSize: font.tiny, color: colors.muted },
  depFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: space.md, borderTopWidth: 1, borderTopColor: colors.forest50 },
  seats: { fontSize: font.small, color: colors.muted },
  fare: { fontSize: font.h2, fontWeight: '900', color: colors.forest900 },
  perPax: { fontSize: font.tiny, color: colors.forest500 },
  selectBtn: { backgroundColor: colors.forest700, borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 12 },
  selectText: { color: colors.white, fontWeight: '800' },
  upcoming: { backgroundColor: colors.forest700, borderRadius: radius.xl, padding: space.lg, gap: 4 },
  upLabel: { color: colors.lime200, fontWeight: '800', fontSize: font.tiny, textTransform: 'uppercase' },
  upRef: { color: colors.white, fontWeight: '900', fontSize: font.h2 },
  upMeta: { color: colors.forest100, fontSize: font.small },
});
