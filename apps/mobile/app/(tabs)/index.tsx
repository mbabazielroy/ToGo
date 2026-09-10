import { useMemo, useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Loading, ErrorRow, EmptyState, Separator, SectionHeading, Segmented, Group } from '../../src/components/ui';
import { ModeTag } from '../../src/components/Screen';
import { DepartureRow } from '../../src/components/DepartureRow';
import { SelectSheet } from '../../src/components/SelectSheet';
import { useAdapter, useDataEpoch } from '../../src/data/AdapterProvider';
import { useSearch } from '../../src/state/search';
import { useAsync } from '../../src/hooks/useAsync';
import { haptics } from '../../src/lib/feedback';
import { colors, radius, space, font, SCREEN, control } from '../../src/theme';
import { addDays, kampalaToday, formatDate, formatTime } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import { tripJourney } from '@shared/data/journey';
import type { DirectionCode } from '@shared/data/adapter';

const DAY_LABEL = (d: string, i: number) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatDate(d));

export default function Home() {
  const adapter = useAdapter();
  const router = useRouter();
  const epoch = useDataEpoch();
  const insets = useSafeAreaInsets();
  const { criteria, set } = useSearch();
  const [sheet, setSheet] = useState<null | 'journey' | 'hub'>(null);

  const cities = DIRECTION_CITIES[criteria.direction];

  const hubs = useAsync(() => adapter.listHubs(), [epoch]);
  const trips = useAsync(() => adapter.searchTrips(criteria), [criteria.direction, criteria.date, criteria.hubId, epoch]);
  const bookings = useAsync(() => adapter.myBookings(), [epoch]);
  const notifs = useAsync(() => adapter.listNotifications(), [epoch]);

  const originHubs = useMemo(() => (hubs.data ?? []).filter((h) => h.city === cities.origin), [hubs.data, cities.origin]);
  const selectedHub = originHubs.find((h) => h.id === criteria.hubId);
  const upcoming = (bookings.data ?? []).filter((b) => ['reserved', 'checked_in', 'boarded'].includes(b.status));
  const unread = (notifs.data ?? []).filter((n) => !n.readAt).length;
  const days = [0, 1, 2].map((d) => addDays(kampalaToday(), d));
  const dateLabel = criteria.date === kampalaToday() ? 'Today' : formatDate(criteria.date);

  const chooseHub = (id: string | null) => { haptics.select(); set({ hubId: id }); setSheet(null); };
  const setDirection = (d: DirectionCode) => { haptics.select(); set({ direction: d, hubId: null }); };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Identity + notifications */}
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <View style={styles.logo}><Text style={styles.logoText}>T</Text></View>
          <Text style={styles.wordmark}>ToGo</Text>
          <ModeTag />
        </View>
        <Pressable
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          hitSlop={8}
          style={styles.bell}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.forest700} />
          {unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>}
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: insets.bottom + space.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Find a departure</Text>

        {/* Active trip */}
        {upcoming.length > 0 && (
          <Group style={{ marginBottom: space.lg }}>
            <FormRow
              onPress={() => router.push(`/trip/${upcoming[0].id}`)}
              accessibilityLabel={`Active trip ${upcoming[0].reference}, pickup ${formatTime(upcoming[0].pickupTimeSnapshot)}`}
              icon="ticket-outline"
              label="Active trip"
              value={`${upcoming[0].reference} · ${formatTime(upcoming[0].pickupTimeSnapshot)}`}
              chevron
            />
          </Group>
        )}

        {/* Search form */}
        <Group>
          <FormRow onPress={() => setSheet('journey')} label="Route" value={`${cities.origin} → ${cities.destination}`} chevron accessibilityLabel={`Route ${cities.origin} to ${cities.destination}. Change.`} />
          <Separator inset={SCREEN} />
          <FormRow onPress={() => setSheet('journey')} label="Date" value={dateLabel} chevron accessibilityLabel={`Date ${dateLabel}. Change.`} />
          <Separator inset={SCREEN} />
          <FormRow onPress={() => setSheet('hub')} label="Pickup" value={selectedHub ? selectedHub.name : `Any hub in ${cities.origin}`} valueStrong chevron accessibilityLabel={`Pickup hub ${selectedHub ? selectedHub.name : `any hub in ${cities.origin}`}. Change.`} />
          <Separator inset={SCREEN} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Passengers</Text>
            <View style={styles.stepper}>
              <Pressable onPress={() => set({ passengers: Math.max(1, criteria.passengers - 1) })} accessibilityRole="button" accessibilityLabel="Fewer passengers" style={styles.stepBtn}>
                <Ionicons name="remove" size={20} color={criteria.passengers <= 1 ? colors.faint : colors.forest700} />
              </Pressable>
              <Text style={styles.stepVal} accessibilityLabel={`${criteria.passengers} passengers`}>{criteria.passengers}</Text>
              <Pressable onPress={() => set({ passengers: Math.min(5, criteria.passengers + 1) })} accessibilityRole="button" accessibilityLabel="More passengers" style={styles.stepBtn}>
                <Ionicons name="add" size={20} color={criteria.passengers >= 5 ? colors.faint : colors.forest700} />
              </Pressable>
            </View>
          </View>
        </Group>

        {/* Departures */}
        <SectionHeading title="Departures" />
        {trips.loading && <Loading />}
        {trips.error && <ErrorRow message={trips.error} onRetry={trips.reload} />}
        {trips.data && trips.data.length === 0 && (
          <EmptyState title="No departures">Try another day, switch route, or choose “Any hub”.</EmptyState>
        )}
        {trips.data && trips.data.length > 0 && (
          <Group style={{ paddingHorizontal: SCREEN }}>
            {trips.data.map((t, i) => {
              const j = tripJourney(t, criteria.hubId);
              return (
                <View key={t.id}>
                  {i > 0 && <Separator inset={76} />}
                  <DepartureRow
                    trip={t}
                    pickup={j.pickup}
                    seatsNeeded={criteria.passengers}
                    onPress={() => router.push(`/book/${t.id}?hub=${j.pickup?.hubId ?? ''}&pax=${criteria.passengers}`)}
                  />
                </View>
              );
            })}
          </Group>
        )}
        <Text style={styles.footNote}>
          Times are Africa/Kampala. The pickup time is when your bus reaches your hub; the origin departure is earlier.
        </Text>
      </ScrollView>

      {/* Route + date */}
      <SelectSheet visible={sheet === 'journey'} title="Route" onClose={() => setSheet(null)}>
        <Text style={styles.sheetLabel}>Direction</Text>
        <Segmented
          segments={(['KLA_MBR', 'MBR_KLA'] as DirectionCode[]).map((d) => ({ value: d, label: `${DIRECTION_CITIES[d].origin} → ${DIRECTION_CITIES[d].destination}` }))}
          value={criteria.direction}
          onChange={setDirection}
          accessibilityLabel="Travel direction"
        />
        <Text style={[styles.sheetLabel, { marginTop: space.lg }]}>Date</Text>
        <Group>
          {days.map((d, i) => {
            const active = criteria.date === d;
            return (
              <View key={d}>
                {i > 0 && <Separator inset={SCREEN} />}
                <CheckRow label={DAY_LABEL(d, i)} selected={active} onPress={() => set({ date: d })} />
              </View>
            );
          })}
        </Group>
      </SelectSheet>

      {/* Hub picker */}
      <SelectSheet visible={sheet === 'hub'} title={`Pickup in ${cities.origin}`} onClose={() => setSheet(null)}>
        {hubs.loading ? <Loading /> : hubs.error ? <ErrorRow message={hubs.error} onRetry={hubs.reload} /> : (
          <>
            <Group>
              <CheckRow label="Any hub" sub={`Every departure in ${cities.origin}`} selected={!criteria.hubId} onPress={() => chooseHub(null)} />
              {originHubs.map((h) => (
                <View key={h.id}>
                  <Separator inset={SCREEN} />
                  <CheckRow label={h.name} sub={h.area} selected={criteria.hubId === h.id} onPress={() => chooseHub(h.id)} />
                </View>
              ))}
            </Group>
            {originHubs.length === 0 && <Text style={styles.sheetLabel}>No approved hubs in this city yet.</Text>}
            {selectedHub && (
              <Pressable onPress={() => { setSheet(null); router.push(`/hub/${selectedHub.id}`); }} accessibilityRole="button" style={styles.detailsLink}>
                <Text style={styles.detailsLinkText}>View {selectedHub.name} details</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.forest700} />
              </Pressable>
            )}
          </>
        )}
      </SelectSheet>
    </View>
  );
}

function FormRow({ label, value, valueStrong, chevron, onPress, icon, accessibilityLabel }: {
  label: string; value: string; valueStrong?: boolean; chevron?: boolean; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; accessibilityLabel?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? `${label}, ${value}`} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.forest50 }]}>
      {icon && <Ionicons name={icon} size={20} color={colors.forest700} style={{ marginRight: space.sm }} />}
      <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
      <Text style={[styles.rowValue, valueStrong && { color: colors.ink, fontWeight: '600' }]} numberOfLines={1}>{value}</Text>
      {chevron && <Ionicons name="chevron-forward" size={18} color={colors.faint} style={{ marginLeft: 6 }} />}
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SCREEN, paddingTop: space.sm, paddingBottom: space.xs },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 26, height: 26, borderRadius: 7, backgroundColor: colors.forest700, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  wordmark: { color: colors.ink, fontWeight: '700', fontSize: font.h2, letterSpacing: -0.2 },
  bell: { width: control.small, height: control.small, borderRadius: control.small / 2, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.red600, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },

  title: { fontSize: font.h1, fontWeight: '700', color: colors.ink, marginTop: space.xs, marginBottom: space.md },

  row: { flexDirection: 'row', alignItems: 'center', minHeight: control.row + 6, paddingHorizontal: SCREEN, paddingVertical: 8 },
  rowLabel: { fontSize: font.body, color: colors.ink, flexShrink: 0 },
  rowValue: { flex: 1, textAlign: 'right', fontSize: font.body, color: colors.muted, marginLeft: space.md },
  stepper: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  stepBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepVal: { minWidth: 24, textAlign: 'center', fontSize: font.body, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },

  footNote: { color: colors.muted, fontSize: font.tiny, marginTop: space.md, paddingHorizontal: space.xs, lineHeight: 17 },

  sheetLabel: { fontSize: font.tiny, fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.4, color: colors.muted, marginBottom: space.xs, paddingHorizontal: space.xs },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: SCREEN, minHeight: control.height, paddingVertical: 8 },
  checkLabel: { fontSize: font.body, color: colors.ink },
  checkSub: { fontSize: font.small, color: colors.muted, marginTop: 1 },
  detailsLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: space.md, marginTop: space.sm },
  detailsLinkText: { color: colors.forest700, fontWeight: '500', fontSize: font.body },
});
