import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Loading, ErrorRow, EmptyState, Separator } from '../../src/components/ui';
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

const DAY_LABELS = (d: string, i: number) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatDate(d));

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
      {/* Top bar */}
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
          <Ionicons name="notifications-outline" size={22} color={colors.ink} />
          {unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>}
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: insets.bottom + space.xxl, gap: space.md }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Active trip — slim resume row */}
        {upcoming.length > 0 && (
          <Pressable
            onPress={() => router.push(`/trip/${upcoming[0].id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Active trip ${upcoming[0].reference}, pickup ${formatTime(upcoming[0].pickupTimeSnapshot)}`}
            style={({ pressed }) => [styles.resume, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="ticket-outline" size={18} color={colors.forest700} />
            <Text style={styles.resumeText} numberOfLines={1}>
              Active trip {upcoming[0].reference} · pickup {formatTime(upcoming[0].pickupTimeSnapshot)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.forest700} />
          </Pressable>
        )}

        {/* Search panel: journey + pickup */}
        <View style={styles.panel}>
          <Pressable onPress={() => setSheet('journey')} accessibilityRole="button" accessibilityLabel={`Journey ${cities.origin} to ${cities.destination}, ${dateLabel}. Change.`} style={({ pressed }) => [styles.panelRow, pressed && styles.pressed]}>
            <Ionicons name="git-branch-outline" size={20} color={colors.forest700} style={styles.rowIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowValue}>{cities.origin} → {cities.destination}</Text>
              <Text style={styles.rowSub}>{dateLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
          <Separator inset={48} />
          <Pressable onPress={() => setSheet('hub')} accessibilityRole="button" accessibilityLabel={`Pickup hub ${selectedHub ? selectedHub.name : `any hub in ${cities.origin}`}. Change.`} style={({ pressed }) => [styles.panelRow, pressed && styles.pressed]}>
            <Ionicons name="location-outline" size={20} color={colors.forest700} style={styles.rowIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Pickup</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{selectedHub ? selectedHub.name : `Any hub in ${cities.origin}`}</Text>
            </View>
            <Text style={styles.change}>Change</Text>
          </Pressable>
        </View>

        {/* Filter row: date + passengers */}
        <View style={styles.filterRow}>
          <Pressable onPress={() => setSheet('journey')} accessibilityRole="button" accessibilityLabel={`Date ${dateLabel}. Change.`} style={({ pressed }) => [styles.datePill, pressed && styles.pressed]}>
            <Ionicons name="calendar-outline" size={16} color={colors.inkSoft} />
            <Text style={styles.datePillText}>{dateLabel}</Text>
          </Pressable>
          <View style={styles.stepper}>
            <Pressable onPress={() => set({ passengers: Math.max(1, criteria.passengers - 1) })} accessibilityRole="button" accessibilityLabel="Fewer passengers" style={styles.stepBtn}>
              <Ionicons name="remove" size={18} color={colors.forest700} />
            </Pressable>
            <Text style={styles.stepVal} accessibilityLabel={`${criteria.passengers} passengers`}>{criteria.passengers} pax</Text>
            <Pressable onPress={() => set({ passengers: Math.min(5, criteria.passengers + 1) })} accessibilityRole="button" accessibilityLabel="More passengers" style={styles.stepBtn}>
              <Ionicons name="add" size={18} color={colors.forest700} />
            </Pressable>
          </View>
        </View>

        {/* Departures */}
        <Text style={styles.heading}>Departures{trips.data ? ` · ${trips.data.length}` : ''}</Text>
        {trips.loading && <Loading />}
        {trips.error && <ErrorRow message={trips.error} onRetry={trips.reload} />}
        {trips.data && trips.data.length === 0 && (
          <EmptyState title="No departures match">Try another day, switch direction, or choose “Any hub”.</EmptyState>
        )}
        {trips.data && trips.data.length > 0 && (
          <View style={styles.list}>
            {trips.data.map((t, i) => {
              const j = tripJourney(t, criteria.hubId);
              return (
                <View key={t.id}>
                  {i > 0 && <Separator />}
                  <DepartureRow
                    trip={t}
                    pickup={j.pickup}
                    seatsNeeded={criteria.passengers}
                    onPress={() => router.push(`/book/${t.id}?hub=${j.pickup?.hubId ?? ''}&pax=${criteria.passengers}`)}
                  />
                </View>
              );
            })}
          </View>
        )}
        <Text style={styles.footNote}>
          Times are Africa/Kampala. The pickup time is when your bus reaches your hub — the origin departure is earlier.
        </Text>
      </ScrollView>

      {/* Focused selection sheets */}
      <SelectSheet visible={sheet === 'journey'} title="Journey" onClose={() => setSheet(null)}>
        <Text style={styles.sheetLabel}>Direction</Text>
        {(['KLA_MBR', 'MBR_KLA'] as DirectionCode[]).map((d) => {
          const c = DIRECTION_CITIES[d];
          const active = criteria.direction === d;
          return (
            <Pressable key={d} onPress={() => setDirection(d)} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.option, active && styles.optionActive]}>
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{c.origin} → {c.destination}</Text>
              {active && <Ionicons name="checkmark" size={20} color={colors.forest700} />}
            </Pressable>
          );
        })}
        <Text style={[styles.sheetLabel, { marginTop: space.md }]}>Date</Text>
        {days.map((d, i) => {
          const active = criteria.date === d;
          return (
            <Pressable key={d} onPress={() => { set({ date: d }); }} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.option, active && styles.optionActive]}>
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{DAY_LABELS(d, i)}</Text>
              {active && <Ionicons name="checkmark" size={20} color={colors.forest700} />}
            </Pressable>
          );
        })}
      </SelectSheet>

      <SelectSheet visible={sheet === 'hub'} title={`Pickup hub in ${cities.origin}`} onClose={() => setSheet(null)}>
        {hubs.loading ? <Loading /> : hubs.error ? <ErrorRow message={hubs.error} onRetry={hubs.reload} /> : (
          <>
            <Pressable onPress={() => chooseHub(null)} accessibilityRole="button" accessibilityState={{ selected: !criteria.hubId }} style={[styles.option, !criteria.hubId && styles.optionActive]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionText, !criteria.hubId && styles.optionTextActive]}>Any hub</Text>
                <Text style={styles.optionSub}>Show every departure in {cities.origin}</Text>
              </View>
              {!criteria.hubId && <Ionicons name="checkmark" size={20} color={colors.forest700} />}
            </Pressable>
            {originHubs.map((h) => {
              const active = criteria.hubId === h.id;
              return (
                <Pressable key={h.id} onPress={() => chooseHub(h.id)} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.option, active && styles.optionActive]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionText, active && styles.optionTextActive]} numberOfLines={1}>{h.name}</Text>
                    <Text style={styles.optionSub} numberOfLines={1}>{h.area}</Text>
                  </View>
                  {active ? <Ionicons name="checkmark" size={20} color={colors.forest700} /> : <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
                </Pressable>
              );
            })}
            {originHubs.length === 0 && <Text style={styles.optionSub}>No approved hubs in this city yet.</Text>}
            <Pressable onPress={() => { if (selectedHub) { setSheet(null); router.push(`/hub/${selectedHub.id}`); } }} disabled={!selectedHub} accessibilityRole="button" style={[styles.detailsLink, !selectedHub && { opacity: 0.4 }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.forest700} />
              <Text style={styles.detailsLinkText}>{selectedHub ? `View ${selectedHub.name} details` : 'Select a hub to view its details'}</Text>
            </Pressable>
          </>
        )}
      </SelectSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SCREEN, paddingTop: space.sm, paddingBottom: space.sm },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.forest700, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.white, fontWeight: '900', fontSize: 15 },
  wordmark: { color: colors.ink, fontWeight: '900', fontSize: font.h2, letterSpacing: -0.3 },
  bell: { width: control.small, height: control.small, borderRadius: control.small / 2, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.red600, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },

  resume: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.forest50, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: control.small, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.forest200 },
  resumeText: { flex: 1, color: colors.forest800, fontWeight: '700', fontSize: font.small },

  panel: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, overflow: 'hidden' },
  panelRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, minHeight: 60 },
  pressed: { backgroundColor: colors.forest50 },
  rowIcon: { width: 32 },
  rowLabel: { fontSize: font.tiny, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.muted },
  rowValue: { fontSize: font.body, fontWeight: '700', color: colors.ink },
  rowSub: { fontSize: font.small, color: colors.muted, marginTop: 1 },
  change: { color: colors.forest700, fontWeight: '700', fontSize: font.small },

  filterRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, height: control.small },
  datePillText: { color: colors.ink, fontWeight: '700', fontSize: font.small },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, height: control.small },
  stepBtn: { width: 42, height: control.small, alignItems: 'center', justifyContent: 'center' },
  stepVal: { minWidth: 48, textAlign: 'center', fontSize: font.small, fontWeight: '800', color: colors.ink },

  heading: { fontSize: font.small, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.muted, marginTop: space.xs },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, paddingHorizontal: space.md },
  footNote: { color: colors.muted, fontSize: font.tiny, marginTop: space.xs, lineHeight: 16 },

  sheetLabel: { fontSize: font.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.muted, marginBottom: 2 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: control.height },
  optionActive: { borderColor: colors.forest600, backgroundColor: colors.forest50 },
  optionText: { fontSize: font.body, fontWeight: '700', color: colors.ink },
  optionTextActive: { color: colors.forest800 },
  optionSub: { fontSize: font.small, color: colors.muted, marginTop: 1 },
  detailsLink: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: space.md, marginTop: space.xs },
  detailsLinkText: { color: colors.forest700, fontWeight: '700', fontSize: font.small },
});
