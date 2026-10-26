import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Group, Separator, Loading, ErrorRow, EmptyState, SectionHeading, LineBadge, StatTile } from '@/components/ui';
import { TripStatusPill } from '@/components/StatusPill';
import { CrewHeader } from '@/crew/CrewHeader';
import { useHubBoard } from '@/crew/AttendantToday';
import { useAdapter, useDataEpoch } from '@/data/AdapterProvider';
import { useSession } from '@/session/SessionProvider';
import { useAsync } from '@/hooks/useAsync';
import { useNow, leadTime } from '@/hooks/useNow';
import { lineFor } from '@/lib/lines';
import { colors, space, font, SCREEN } from '@/theme';
import { formatTime } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import type { TripView } from '@shared/data/adapter';

/** The whole day at a glance: every assigned departure (driver/conductor) or every
 *  bus due at the hub (attendant). Tapping a trip opens it on the Today tab. */
export default function Shift() {
  const { identity } = useSession();
  if (!identity?.staffId) return null;
  return identity.role === 'attendant' ? <HubShift staffId={identity.staffId} /> : <TripShift staffId={identity.staffId} />;
}

function TripShift({ staffId }: { staffId: string }) {
  const adapter = useAdapter();
  const epoch = useDataEpoch();
  const router = useRouter();
  const now = useNow(60000);
  const [tick, setTick] = useState(0);
  const trips = useAsync(() => adapter.staffTrips(staffId), [staffId, epoch, tick]);
  const list = trips.data ?? [];
  const done = list.filter((t) => t.status === 'completed').length;
  const seats = list.reduce((n, t) => n + t.seatsReserved, 0);

  return (
    <View style={styles.root}>
      <CrewHeader title="Today's shift" />
      <ScrollView contentContainerStyle={{ padding: SCREEN, gap: space.md, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setTick((n) => n + 1)} tintColor={colors.forest700} />}>
        {trips.loading && !trips.data && <Loading />}
        {trips.error && <ErrorRow message={trips.error} onRetry={() => setTick((n) => n + 1)} />}
        {list.length > 0 && (
          <View style={styles.stats}>
            <StatTile label="Departures" value={list.length} />
            <StatTile label="Completed" value={done} tone={colors.forest700} />
            <StatTile label="Seats booked" value={seats} />
          </View>
        )}
        {!trips.loading && list.length === 0 && <EmptyState title="Nothing assigned today">Check back later or ask operations.</EmptyState>}
        {list.length > 0 && <SectionHeading title="Departures" />}
        {list.length > 0 && (
          <Group>
            {list.map((t, i) => (
              <View key={t.id}>
                {i > 0 && <Separator inset={SCREEN + 60} />}
                <TripRow trip={t} now={now} onPress={() => router.navigate({ pathname: '/crew', params: { trip: t.id } })} />
              </View>
            ))}
          </Group>
        )}
      </ScrollView>
    </View>
  );
}

function TripRow({ trip, now, onPress }: { trip: TripView; now: Date; onPress: () => void }) {
  const line = lineFor(trip.operatorId, trip.operatorName);
  const cities = DIRECTION_CITIES[trip.direction];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.forest50 }]}>
      <View style={{ width: 52 }}>
        <Text style={styles.time}>{formatTime(trip.originDeparture)}</Text>
        <LineBadge code={line.code} color={line.color} size="sm" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.route}>{cities.origin} → {cities.destination}</Text>
        <Text style={styles.meta}>{trip.seatsReserved}/{trip.capacity} booked · {trip.status === 'scheduled' ? leadTime(trip.originDeparture, now) : trip.vehicleLabel ?? ''}</Text>
        <View style={{ marginTop: 6 }}><TripStatusPill status={trip.status} delayed={trip.delayMinutes > 0} /></View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

function HubShift({ staffId }: { staffId: string }) {
  const [tick, setTick] = useState(0);
  const now = useNow(60000);
  const data = useHubBoard(staffId, tick);
  const d = data.data;
  return (
    <View style={styles.root}>
      <CrewHeader title={d?.hub?.name ?? 'Hub schedule'} />
      <ScrollView contentContainerStyle={{ padding: SCREEN, gap: space.md, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setTick((n) => n + 1)} tintColor={colors.forest700} />}>
        {data.loading && !data.data && <Loading />}
        {data.error && <ErrorRow message={data.error} onRetry={() => setTick((n) => n + 1)} />}
        {d?.hub && (
          <Group style={{ padding: space.lg, gap: 6 }}>
            <Text style={styles.hubArea}>{d.hub.area}</Text>
            {d.hub.openingHours ? <Text style={styles.meta}>Open {d.hub.openingHours}</Text> : null}
            {d.hub.arrivalInstructions ? <Text style={styles.hint}>{d.hub.arrivalInstructions}</Text> : null}
          </Group>
        )}
        {d && <SectionHeading title="Departures through this hub" />}
        {d && d.buses.length === 0 && <EmptyState title="No buses with reservations">Buses appear once passengers book from this hub.</EmptyState>}
        {d && d.buses.length > 0 && (
          <Group>
            {d.buses.map((b, i) => {
              const line = lineFor(b.trip.operatorId, b.trip.operatorName);
              return (
                <View key={b.trip.id}>
                  {i > 0 && <Separator inset={SCREEN + 60} />}
                  <View style={styles.row}>
                    <View style={{ width: 52 }}>
                      <Text style={styles.time}>{formatTime(b.pickupTime)}</Text>
                      <LineBadge code={line.code} color={line.color} size="sm" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.route}>To {DIRECTION_CITIES[b.trip.direction].destination}</Text>
                      <Text style={styles.meta}>{b.trip.operatorName} · {b.rows.reduce((n, r) => n + r.seats, 0)} seats · {leadTime(b.pickupTime, now)}</Text>
                      <View style={{ marginTop: 6 }}><TripStatusPill status={b.trip.status} delayed={b.trip.delayMinutes > 0} /></View>
                    </View>
                  </View>
                </View>
              );
            })}
          </Group>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  stats: { flexDirection: 'row', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: SCREEN, paddingVertical: space.md },
  time: { fontSize: font.title, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'], marginBottom: 4 },
  route: { fontSize: font.body, fontWeight: '700', color: colors.ink },
  meta: { fontSize: font.tiny, color: colors.muted, marginTop: 2 },
  hubArea: { fontSize: font.body, fontWeight: '600', color: colors.ink },
  hint: { fontSize: font.small, color: colors.inkSoft, lineHeight: 20 },
});
