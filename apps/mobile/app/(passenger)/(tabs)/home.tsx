import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Loading, ErrorRow, EmptyState, Separator, Group, LineBadge } from '@/components/ui';
import { ModeTag } from '@/components/Screen';
import { DepartureRow } from '@/components/DepartureRow';
import { SelectSheet } from '@/components/SelectSheet';
import { useAdapter, useDataEpoch } from '@/data/AdapterProvider';
import { useSession } from '@/session/SessionProvider';
import { useSearch } from '@/state/search';
import { useAsync } from '@/hooks/useAsync';
import { useNow, countdown, greeting, leadTime } from '@/hooks/useNow';
import { haptics } from '@/lib/feedback';
import { lineFor } from '@/lib/lines';
import { visibleAlerts } from '@/lib/alerts';
import { colors, radius, space, font, SCREEN, control } from '@/theme';
import { addDays, kampalaToday, formatDate, formatTime } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import { tripJourney } from '@shared/data/journey';
import type { BookingView } from '@shared/data/adapter';

const ACTIVE = ['reserved', 'checked_in', 'boarded'];

export default function Home() {
  const adapter = useAdapter();
  const router = useRouter();
  const epoch = useDataEpoch();
  const insets = useSafeAreaInsets();
  const now = useNow(30000);
  const { profile } = useSession();
  const { criteria, set, toggleDirection } = useSearch();
  const [sheet, setSheet] = useState<null | 'hub'>(null);
  const [showEarlier, setShowEarlier] = useState(false);

  const cities = DIRECTION_CITIES[criteria.direction];
  const today = kampalaToday(now);
  const days = [0, 1, 2].map((d) => addDays(today, d));

  const hubs = useAsync(() => adapter.listHubs(), [epoch]);
  const trips = useAsync(() => adapter.searchTrips(criteria), [criteria.direction, criteria.date, criteria.hubId, epoch]);
  const bookings = useAsync(() => adapter.myBookings(), [epoch]);
  const notifs = useAsync(() => adapter.listNotifications(), [epoch]);

  const next: BookingView | undefined = useMemo(() => (bookings.data ?? [])
    .filter((b) => ACTIVE.includes(b.status))
    .sort((a, b) => a.pickupTimeSnapshot.localeCompare(b.pickupTimeSnapshot))[0], [bookings.data]);
  const nextTrip = useAsync(() => (next ? adapter.getTrip(next.tripId) : Promise.resolve(null)), [next?.tripId, epoch]);

  const originHubs = useMemo(() => (hubs.data ?? []).filter((h) => h.city === cities.origin), [hubs.data, cities.origin]);
  const selectedHub = originHubs.find((h) => h.id === criteria.hubId);
  const unread = visibleAlerts(notifs.data ?? [], profile).filter((n) => !n.readAt).length;

  // Hide departures whose pickup has already passed (today only), Transit-style.
  const list = useMemo(() => (trips.data ?? []).map((t) => ({ t, j: tripJourney(t, criteria.hubId) })), [trips.data, criteria.hubId]);
  const upcoming = list.filter(({ t, j }) => t.status !== 'completed' && new Date(j.pickupTimeISO).getTime() > now.getTime() - 60000);
  const earlier = list.filter((x) => !upcoming.includes(x));
  const shown = showEarlier ? list : upcoming;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    hubs.reload(); trips.reload(); bookings.reload(); notifs.reload(); nextTrip.reload();
    setTimeout(() => setRefreshing(false), 600);
  };

  const firstName = profile.name.trim().split(/\s+/)[0];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello} numberOfLines={1}>{greeting(now)}{firstName ? `, ${firstName}` : ''}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <Text style={styles.sub}>Where are you headed?</Text>
            <ModeTag />
          </View>
        </View>
        <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Notifications, ${unread} new` : 'Notifications'} hitSlop={8} style={styles.bell}>
          <Ionicons name="notifications-outline" size={23} color={colors.ink} />
          {unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>}
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: insets.bottom + space.xxl, gap: space.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.forest700} />}
      >
        {next && <NextTripCard booking={next} tripStatus={nextTrip.data?.status} delay={nextTrip.data?.delayMinutes ?? 0}
          operatorId={nextTrip.data?.operatorId} operatorName={nextTrip.data?.operatorName}
          hubName={nextTrip.data ? tripJourney(nextTrip.data, next.pickupHubId).pickup?.hubName : undefined}
          destination={nextTrip.data ? DIRECTION_CITIES[nextTrip.data.direction].destination : undefined}
          now={now} onOpen={() => router.push(`/trip/${next.id}`)} />}

        {/* Trip planner */}
        <View style={styles.planner}>
          <View style={styles.cityRail}>
            <View style={styles.dotFrom} />
            <View style={styles.railLine} />
            <Ionicons name="location" size={14} color={colors.red600} />
          </View>
          <View style={{ flex: 1 }}>
            <Pressable onPress={() => setSheet('hub')} accessibilityRole="button" accessibilityLabel={`From ${selectedHub?.name ?? `any hub in ${cities.origin}`}. Change pickup hub.`} style={styles.cityRow}>
              <Text style={styles.cityLabel}>From</Text>
              <Text style={styles.cityValue} numberOfLines={1}>{selectedHub ? selectedHub.name : cities.origin}</Text>
              {!selectedHub && <Text style={styles.cityHint}>Any hub</Text>}
            </Pressable>
            <Separator />
            <View style={styles.cityRow}>
              <Text style={styles.cityLabel}>To</Text>
              <Text style={styles.cityValue}>{cities.destination}</Text>
            </View>
          </View>
          <Pressable onPress={() => { haptics.select(); toggleDirection(); }} accessibilityRole="button" accessibilityLabel={`Swap direction. Now ${cities.origin} to ${cities.destination}.`} style={styles.swap} hitSlop={6}>
            <Ionicons name="swap-vertical" size={20} color={colors.forest700} />
          </Pressable>
        </View>


        <View style={styles.chipsRow}>
          {days.map((d, i) => {
            const on = criteria.date === d;
            return (
              <Pressable key={d} onPress={() => { haptics.select(); set({ date: d }); setShowEarlier(false); }} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={[styles.dayChip, on && styles.dayChipOn]}>
                <Text style={[styles.dayChipText, on && styles.dayChipTextOn]}>{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatDate(d)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.paxRow}>
          <Text style={styles.paxLabel}>Passengers</Text>
          <View style={styles.pax} accessibilityLabel={`${criteria.passengers} passenger${criteria.passengers === 1 ? '' : 's'}`}>
            <Pressable onPress={() => set({ passengers: Math.max(1, criteria.passengers - 1) })} accessibilityRole="button" accessibilityLabel="Fewer passengers" hitSlop={6} style={styles.paxBtn}>
              <Ionicons name="remove" size={16} color={criteria.passengers <= 1 ? colors.faint : colors.ink} />
            </Pressable>
            <Ionicons name="person" size={13} color={colors.inkSoft} />
            <Text style={styles.paxVal}>{criteria.passengers}</Text>
            <Pressable onPress={() => set({ passengers: Math.min(5, criteria.passengers + 1) })} accessibilityRole="button" accessibilityLabel="More passengers" hitSlop={6} style={styles.paxBtn}>
              <Ionicons name="add" size={16} color={criteria.passengers >= 5 ? colors.faint : colors.ink} />
            </Pressable>
          </View>
        </View>

        <View style={styles.listHead}>
          <Text style={styles.listTitle}>Departures</Text>
          {trips.data && <Text style={styles.listCount}>{upcoming.length} {criteria.date === today ? 'still to come' : 'scheduled'}</Text>}
        </View>

        {trips.loading && !trips.data && <Loading />}
        {trips.error && <ErrorRow message={trips.error} onRetry={trips.reload} />}
        {trips.data && shown.length === 0 && (
          <EmptyState title={list.length > 0 ? 'No more departures today' : 'No departures for this day'}>
            {list.length > 0 ? 'Every bus for today has left. Try tomorrow, or show earlier departures.' : 'Try another day or switch direction.'}
          </EmptyState>
        )}
        {shown.map(({ t, j }) => (
          <DepartureRow key={t.id} trip={t} pickup={j.pickup} seatsNeeded={criteria.passengers} now={now}
            onPress={() => router.push(`/book/${t.id}?hub=${j.pickup?.hubId ?? ''}&pax=${criteria.passengers}`)} />
        ))}
        {earlier.length > 0 && (
          <Pressable onPress={() => setShowEarlier((v) => !v)} accessibilityRole="button" style={styles.earlier}>
            <Text style={styles.earlierText}>{showEarlier ? 'Hide earlier departures' : `Show ${earlier.length} earlier departure${earlier.length === 1 ? '' : 's'}`}</Text>
          </Pressable>
        )}
        <Text style={styles.footNote}>Countdowns are to the bus reaching your pickup hub. Times in Kampala time (EAT).</Text>
      </ScrollView>

      <SelectSheet visible={sheet === 'hub'} title={`Pickup in ${cities.origin}`} onClose={() => setSheet(null)}>
        {hubs.loading ? <Loading /> : hubs.error ? <ErrorRow message={hubs.error} onRetry={hubs.reload} /> : (
          <>
            <Group>
              <CheckRow label="Any hub" sub={`Every departure from ${cities.origin}`} selected={!criteria.hubId} onPress={() => { haptics.select(); set({ hubId: null }); setSheet(null); }} />
              {originHubs.map((h) => (
                <View key={h.id}>
                  <Separator inset={SCREEN} />
                  <CheckRow label={h.name} sub={h.area} selected={criteria.hubId === h.id} onPress={() => { haptics.select(); set({ hubId: h.id }); setSheet(null); }} />
                </View>
              ))}
            </Group>
            {selectedHub && (
              <Pressable onPress={() => { setSheet(null); router.push(`/hub/${selectedHub.id}`); }} accessibilityRole="button" style={styles.detailsLink}>
                <Text style={styles.detailsLinkText}>About {selectedHub.name}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.forest700} />
              </Pressable>
            )}
          </>
        )}
      </SelectSheet>
    </View>
  );
}

function NextTripCard({ booking, tripStatus, delay, operatorId, operatorName, hubName, destination, now, onOpen }: {
  booking: BookingView; tripStatus?: string; delay: number; operatorId?: string; operatorName?: string; hubName?: string; destination?: string; now: Date; onOpen: () => void;
}) {
  const cd = countdown(booking.pickupTimeSnapshot, now);
  const line = operatorId ? lineFor(operatorId, operatorName) : null;
  const headline = booking.status === 'boarded'
    ? `On your way to ${destination ?? 'your destination'}`
    : booking.status === 'checked_in'
      ? `Checked in at ${hubName ?? 'your hub'}`
      : `Be at ${hubName ?? 'your hub'} ${leadTime(booking.pickupTimeSnapshot, now)}`;
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Your next trip. ${headline}. Open boarding pass.`} style={({ pressed }) => [styles.hero, pressed && { opacity: 0.95 }]}>
      <View style={styles.heroTop}>
        {line && <LineBadge code={line.code} color={line.color} size="sm" />}
        <Text style={styles.heroKicker}>Your next trip{destination ? ` · to ${destination}` : ''}</Text>
        {(tripStatus === 'en_route' || tripStatus === 'boarding') && <View style={styles.heroLive}><View style={styles.heroLiveDot} /><Text style={styles.heroLiveText}>Live</Text></View>}
      </View>
      <View style={styles.heroMid}>
        <Text style={styles.heroHeadline} numberOfLines={2}>{headline}</Text>
        {booking.status !== 'boarded' && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.heroBig}>{cd.value}</Text>
            {cd.unit ? <Text style={styles.heroUnit}>{cd.unit}</Text> : null}
          </View>
        )}
      </View>
      {delay > 0 && <Text style={styles.heroDelay}>Running about {delay} min late</Text>}
      <View style={styles.heroFoot}>
        <Text style={styles.heroMeta}>{booking.reference} · pickup {formatTime(booking.pickupTimeSnapshot)} · {booking.seats} seat{booking.seats === 1 ? '' : 's'}</Text>
        <View style={styles.heroBtn}><Ionicons name="qr-code" size={14} color={colors.forest900} /><Text style={styles.heroBtnText}>Pass</Text></View>
      </View>
    </Pressable>
  );
}

function CheckRow({ label, sub, selected, onPress }: { label: string; sub?: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={({ pressed }) => [styles.checkRow, pressed && { backgroundColor: colors.forest50 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkLabel} numberOfLines={1}>{label}</Text>
        {sub ? <Text style={styles.checkSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {selected && <Ionicons name="checkmark" size={22} color={colors.forest700} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN, paddingTop: space.sm, paddingBottom: space.md },
  hello: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  sub: { fontSize: font.small, color: colors.muted },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.red600, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },

  hero: { backgroundColor: colors.forest900, borderRadius: radius.xxl, padding: space.lg, gap: space.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroKicker: { flex: 1, color: colors.onDarkSoft, fontSize: font.tiny, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroLive: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.live },
  heroLiveText: { color: colors.live, fontSize: 12, fontWeight: '800' },
  heroMid: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  heroHeadline: { flex: 1, color: colors.white, fontSize: font.h2, fontWeight: '800', letterSpacing: -0.3, lineHeight: 28 },
  heroBig: { color: colors.live, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1, lineHeight: 44 },
  heroUnit: { color: colors.onDarkSoft, fontSize: font.tiny, fontWeight: '700', marginTop: -4 },
  heroDelay: { color: '#fbbf24', fontSize: font.small, fontWeight: '700' },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 },
  heroMeta: { flex: 1, color: colors.onDarkSoft, fontSize: font.tiny },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.live, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  heroBtnText: { color: colors.forest900, fontSize: font.tiny, fontWeight: '800' },

  planner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.xl, paddingLeft: space.md, paddingRight: space.sm },
  cityRail: { width: 18, alignItems: 'center', marginRight: space.sm },
  dotFrom: { width: 10, height: 10, borderRadius: 5, borderWidth: 2.5, borderColor: colors.forest700 },
  railLine: { width: 2, height: 30, backgroundColor: colors.separator, marginVertical: 3 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52 },
  cityLabel: { width: 40, fontSize: font.tiny, color: colors.muted, fontWeight: '600' },
  cityValue: { flex: 1, fontSize: font.body, fontWeight: '700', color: colors.ink },
  cityHint: { fontSize: font.tiny, color: colors.forest700, fontWeight: '600' },
  swap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.forest100, alignItems: 'center', justifyContent: 'center', marginLeft: space.sm },

  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayChip: { borderRadius: 999, paddingHorizontal: 12, height: 34, justifyContent: 'center', backgroundColor: colors.surface },
  dayChipOn: { backgroundColor: colors.ink },
  dayChipText: { fontSize: font.tiny, fontWeight: '700', color: colors.inkSoft },
  dayChipTextOn: { color: colors.white },
  paxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -4 },
  paxLabel: { fontSize: font.small, color: colors.inkSoft, fontWeight: '600', paddingHorizontal: space.xs },
  pax: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.surface, borderRadius: 999, height: 34, paddingHorizontal: 2 },
  paxBtn: { width: 28, height: 30, alignItems: 'center', justifyContent: 'center' },
  paxVal: { fontSize: font.tiny, fontWeight: '800', color: colors.ink, minWidth: 12, textAlign: 'center', fontVariant: ['tabular-nums'] },

  listHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.sm },
  listTitle: { fontSize: font.h2, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  listCount: { fontSize: font.tiny, color: colors.muted, fontWeight: '600' },
  earlier: { alignItems: 'center', paddingVertical: space.sm, minHeight: control.small, justifyContent: 'center' },
  earlierText: { color: colors.forest700, fontWeight: '600', fontSize: font.small },
  footNote: { color: colors.muted, fontSize: font.tiny, paddingHorizontal: space.xs, lineHeight: 17, textAlign: 'center' },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: SCREEN, minHeight: control.height, paddingVertical: 8 },
  checkLabel: { fontSize: font.body, color: colors.ink },
  checkSub: { fontSize: font.small, color: colors.muted, marginTop: 1 },
  detailsLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: space.md, marginTop: space.sm },
  detailsLinkText: { color: colors.forest700, fontWeight: '500', fontSize: font.body },
});
