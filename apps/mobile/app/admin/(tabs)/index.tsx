import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Group, Separator, SectionHeading, Loading, ErrorRow, StatTile, ListRow, EmptyState } from '@/components/ui';
import { CrewHeader } from '@/crew/CrewHeader';
import { AdminTripRow, crewGaps } from '@/admin/AdminTripRow';
import { useAdapter, useDataEpoch } from '@/data/AdapterProvider';
import { useAsync } from '@/hooks/useAsync';
import { useNow } from '@/hooks/useNow';
import { colors, space, font, SCREEN, radius } from '@/theme';
import { kampalaToday, formatDate, timeAgo } from '@shared/lib/time';
import { TransitMap } from '@/components/map/TransitMap';
import { tripMapData } from '@/components/map/tripMap';
import { useAppMode } from '@/data/AdapterProvider';
import { CORRIDOR_REGION } from '@shared/data/geo';

/** Today across the network: load, punctuality, crew gaps and incidents. */
export default function AdminOverview() {
  const adapter = useAdapter();
  const epoch = useDataEpoch();
  const router = useRouter();
  const now = useNow(60000);
  const [tick, setTick] = useState(0);
  const today = kampalaToday(now);

  const trips = useAsync(() => adapter.listTripsOn(today), [today, epoch, tick]);
  // Seat totals come from each departure's passenger list so trips that have
  // already travelled still count (a trip's seatsReserved only holds active bookings).
  const manifests = useAsync(
    () => Promise.all((trips.data ?? []).filter((t) => t.status !== 'cancelled').map((t) => adapter.getTripManifest(t.id))),
    [trips.data],
  );
  const incidents = useAsync(() => adapter.listIncidents(), [epoch, tick]);
  const activity = useAsync(() => adapter.listActivity(), [epoch, tick]);
  const hubs = useAsync(() => adapter.listHubs(), [epoch]);
  const mode = useAppMode();

  const k = useMemo(() => {
    const list = trips.data ?? [];
    const running = list.filter((t) => t.status !== 'cancelled');
    const rows = (manifests.data ?? []).flat().filter((r) => r.status !== 'cancelled');
    const seats = rows.reduce((n, r) => n + r.seats, 0);
    const boarded = rows.filter((r) => r.status === 'boarded' || r.status === 'completed').reduce((n, r) => n + r.seats, 0);
    const cap = running.reduce((n, t) => n + t.capacity, 0);
    return {
      total: list.length,
      live: list.filter((t) => t.status === 'en_route' || t.status === 'boarding').length,
      done: list.filter((t) => t.status === 'completed').length,
      delayed: list.filter((t) => t.delayMinutes > 0 && t.status !== 'completed' && t.status !== 'cancelled').length,
      cancelled: list.filter((t) => t.status === 'cancelled').length,
      seats, boarded, cap, load: cap ? Math.round((seats / cap) * 100) : 0,
      gaps: list.filter((t) => crewGaps(t).length > 0),
    };
  }, [trips.data, manifests.data]);
  const open = (incidents.data ?? []).filter((i) => i.open);

  return (
    <View style={styles.root}>
      <CrewHeader title="Operations">
        <Text style={styles.date}>{formatDate(today)} · Kampala ⇄ Mbarara</Text>
      </CrewHeader>
      <ScrollView contentContainerStyle={{ padding: SCREEN, gap: space.md, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setTick((n) => n + 1)} tintColor={colors.forest700} />}>
        {trips.loading && !trips.data && <Loading />}
        {trips.error && <ErrorRow message={trips.error} onRetry={() => setTick((n) => n + 1)} />}

        {trips.data && (
          <>
            <View style={styles.grid}>
              <StatTile label="Departures" value={k.total} hint={`${k.live} live · ${k.done} done`} />
              <StatTile label="Seats booked" value={k.seats} hint={`${k.load}% full · ${k.boarded} travelled`} tone={colors.forest700} />
            </View>
            <View style={styles.grid}>
              <StatTile label="Delayed" value={k.delayed} tone={k.delayed ? colors.amber800 : undefined} />
              <StatTile label="Cancelled" value={k.cancelled} tone={k.cancelled ? colors.red700 : undefined} />
              <StatTile label="Open issues" value={open.length} tone={open.length ? colors.red700 : undefined} />
            </View>

            {hubs.data && (() => {
              const list = trips.data ?? [];
              const live = list.filter((t) => t.status === 'en_route' || t.status === 'boarding');
              // Draw each direction's corridor once, dimmed, with live buses on top.
              const sample = ['KLA_MBR', 'MBR_KLA'].map((d) => list.find((t) => t.direction === d)).filter((t): t is NonNullable<typeof t> => !!t);
              const base = sample.map((t) => tripMapData(t, hubs.data!, now));
              const liveData = live.map((t) => tripMapData(t, hubs.data!, now, { demo: mode === 'demo' }));
              const routes = [...base.flatMap((m) => m.routes.map((r) => ({ ...r, id: `base-${r.id}`, dimmed: true }))), ...liveData.flatMap((m) => m.routes)];
              const stops = base.flatMap((m) => m.stops.map((x) => ({ ...x, id: `${m.routes[0].id}-${x.id}`, passed: false, highlight: false, color: colors.inkSoft })));
              return (
                <View>
                  <TransitMap height={220} routes={routes} stops={stops} buses={liveData.flatMap((m) => m.buses)}
                    focus={[{ latitude: CORRIDOR_REGION.latitude + 0.5, longitude: 32.62 }, { latitude: -0.62, longitude: 30.64 }]}
                    caption={live.length ? `${live.length} bus${live.length === 1 ? '' : 'es'} on the road` : 'No buses on the road right now'} />
                </View>
              );
            })()}

            <Pressable onPress={() => router.push('/admin/new-departure')} accessibilityRole="button" style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}>
              <Ionicons name="add-circle" size={22} color={colors.white} />
              <Text style={styles.ctaText}>Schedule a departure</Text>
            </Pressable>

            <SectionHeading title={`Needs crew · ${k.gaps.length}`} />
            {k.gaps.length === 0 ? (
              <Group style={{ padding: space.lg }}><Text style={styles.ok}>Every departure today has a driver and a conductor.</Text></Group>
            ) : (
              <Group>
                {k.gaps.map((t, i) => (
                  <View key={t.id}>
                    {i > 0 && <Separator inset={SCREEN} />}
                    <AdminTripRow trip={t} onPress={() => router.push(`/admin/trip/${t.id}`)} />
                  </View>
                ))}
              </Group>
            )}
          </>
        )}

        <SectionHeading title={`Issues · ${open.length}`} />
        {incidents.loading && !incidents.data && <Loading />}
        {incidents.data && incidents.data.length === 0 && <EmptyState title="No issues">Missed pickups, delays and cancellations show up here.</EmptyState>}
        {incidents.data && incidents.data.length > 0 && (
          <Group>
            {incidents.data.slice(0, 8).map((i, idx) => (
              <View key={i.id}>
                {idx > 0 && <Separator inset={SCREEN + 44} />}
                <ListRow
                  icon={i.kind === 'missed_pickup' ? 'person-remove-outline' : i.kind === 'trip_cancelled' ? 'close-circle-outline' : 'time-outline'}
                  iconColor={i.open ? (i.kind === 'delay' ? colors.amber600 : colors.red600) : colors.muted}
                  title={i.title} subtitle={`${i.detail} · ${timeAgo(i.at, now)}`}
                  onPress={i.tripId ? () => router.push(`/admin/trip/${i.tripId}`) : undefined}
                />
              </View>
            ))}
          </Group>
        )}

        <SectionHeading title="Recent activity" />
        {activity.data && activity.data.length === 0 && <Text style={styles.ok}>Nothing yet today.</Text>}
        {activity.data && activity.data.length > 0 && (
          <Group style={{ paddingVertical: space.xs }}>
            {activity.data.slice(0, 10).map((a) => (
              <View key={a.id} style={styles.feedRow}>
                <View style={styles.feedDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.feedTitle}>{a.title}</Text>
                  <Text style={styles.feedBody} numberOfLines={2}>{a.body}</Text>
                </View>
                <Text style={styles.feedTime}>{timeAgo(a.createdAt, now)}</Text>
              </View>
            ))}
          </Group>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  date: { color: colors.onDarkSoft, fontSize: font.small, fontWeight: '600' },
  grid: { flexDirection: 'row', gap: space.sm },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.forest700, borderRadius: radius.xl, minHeight: 52 },
  ctaText: { color: colors.white, fontSize: font.body, fontWeight: '700' },
  ok: { color: colors.muted, fontSize: font.small },
  feedRow: { flexDirection: 'row', gap: space.md, paddingHorizontal: SCREEN, paddingVertical: 10 },
  feedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.forest500, marginTop: 6 },
  feedTitle: { fontSize: font.small, fontWeight: '700', color: colors.ink },
  feedBody: { fontSize: font.tiny, color: colors.muted, marginTop: 1, lineHeight: 17 },
  feedTime: { fontSize: 11, color: colors.muted },
});
