import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, BackHandler, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Loading, ErrorRow, EmptyState, Chip, Separator, DemoBadge } from '../../src/components/ui';
import { SegmentedControl } from '../../src/components/SegmentedControl';
import { DepartureRow } from '../../src/components/DepartureRow';
import { SchematicMap } from '../../src/components/SchematicMap';
import { BottomSheet, type BottomSheetHandle, type SnapName } from '../../src/components/BottomSheet';
import { BookingStatusPill } from '../../src/components/StatusPill';
import { useAdapter, useAppMode, useDataEpoch } from '../../src/data/AdapterProvider';
import { useSearch } from '../../src/state/search';
import { useAsync } from '../../src/hooks/useAsync';
import { haptics } from '../../src/lib/feedback';
import { colors, radius, space, font } from '../../src/theme';
import { addDays, kampalaToday, formatDate, formatTime } from '@shared/lib/time';
import type { DirectionCode } from '@shared/data/adapter';

const DIRECTIONS: { value: DirectionCode; label: string }[] = [
  { value: 'KLA_MBR', label: 'Kampala → Mbarara' },
  { value: 'MBR_KLA', label: 'Mbarara → Kampala' },
];

export default function Home() {
  const adapter = useAdapter();
  const router = useRouter();
  const mode = useAppMode();
  const epoch = useDataEpoch();
  const insets = useSafeAreaInsets();
  const { criteria, set } = useSearch();
  const sheet = useRef<BottomSheetHandle>(null);
  const [snap, setSnap] = useState<SnapName>('intermediate');

  // Android hardware Back collapses an expanded sheet instead of leaving the tab.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (snap === 'expanded') { sheet.current?.snapTo('intermediate'); return true; }
        return false;
      });
      return () => sub.remove();
    }, [snap]),
  );

  const originCity = criteria.direction === 'KLA_MBR' ? 'Kampala' : 'Mbarara';
  const destCity = criteria.direction === 'KLA_MBR' ? 'Mbarara' : 'Kampala';

  const hubs = useAsync(() => adapter.listHubs(), [epoch]);
  const trips = useAsync(() => adapter.searchTrips(criteria), [criteria.direction, criteria.date, criteria.hubId, epoch]);
  const bookings = useAsync(() => adapter.myBookings(), [epoch]);
  const notifs = useAsync(() => adapter.listNotifications(), [epoch]);

  const originHubs = useMemo(() => (hubs.data ?? []).filter((h) => h.city === originCity), [hubs.data, originCity]);
  const upcoming = (bookings.data ?? []).filter((b) => ['reserved', 'checked_in', 'boarded'].includes(b.status));
  const unread = (notifs.data ?? []).filter((n) => !n.readAt).length;
  const days = [0, 1, 2].map((d) => addDays(kampalaToday(), d));

  const selectHub = (id: string | null) => {
    haptics.select();
    set({ hubId: id });
    sheet.current?.snapTo('intermediate');
  };

  const sheetHeader = (
    <View style={{ gap: space.sm }}>
      <SegmentedControl
        segments={DIRECTIONS}
        value={criteria.direction}
        onChange={(v) => { haptics.select(); set({ direction: v, hubId: null }); }}
        label="Travel direction"
      />
      <View style={styles.controlRow}>
        <View style={styles.dayChips}>
          {days.map((d, i) => {
            const active = criteria.date === d;
            return (
              <Pressable
                key={d}
                onPress={() => set({ date: d })}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.dayChip, active && styles.dayChipActive]}
              >
                <Text style={[styles.dayChipText, active && styles.dayChipTextActive]} numberOfLines={1}>
                  {i === 0 ? 'Today' : i === 1 ? 'Tmrw' : formatDate(d)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => set({ passengers: Math.max(1, criteria.passengers - 1) })}
            accessibilityRole="button" accessibilityLabel="Fewer passengers"
            style={styles.stepBtn}
          >
            <Ionicons name="remove" size={18} color={colors.forest700} />
          </Pressable>
          <Text style={styles.stepVal} accessibilityLabel={`${criteria.passengers} passengers`}>
            {criteria.passengers}
          </Text>
          <Pressable
            onPress={() => set({ passengers: Math.min(5, criteria.passengers + 1) })}
            accessibilityRole="button" accessibilityLabel="More passengers"
            style={styles.stepBtn}
          >
            <Ionicons name="add" size={18} color={colors.forest700} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Map surface — inset below the floating top controls so its labels don't collide */}
      <View style={[styles.mapLayer, { top: insets.top + (mode === 'demo' ? 154 : 116) }]}>
        <SchematicMap
          hubs={originHubs}
          selectedHubId={criteria.hubId}
          onSelectHub={selectHub}
          originCity={originCity}
          destCity={destCity}
        />
      </View>

      {/* Draggable sheet with hub selection + departures */}
      <BottomSheet ref={sheet} header={sheetHeader} initial="intermediate" collapsedHeight={188} onSnapChange={setSnap}>
        {upcoming.length > 0 && (
          <Pressable
            onPress={() => router.push(`/trip/${upcoming[0].id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Resume your trip ${upcoming[0].reference}`}
            style={styles.resume}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.resumeLabel}>Your active trip</Text>
              <Text style={styles.resumeRef}>{upcoming[0].reference} · pickup {formatTime(upcoming[0].pickupTimeSnapshot)}</Text>
            </View>
            <BookingStatusPill status={upcoming[0].status} />
            <Ionicons name="chevron-forward" size={18} color={colors.lime200} />
          </Pressable>
        )}

        {/* Hub selector */}
        <Text style={styles.groupLabel}>Pickup hub in {originCity}</Text>
        {hubs.loading ? <Loading /> : hubs.error ? <ErrorRow message={hubs.error} onRetry={hubs.reload} /> : (
          <View style={styles.hubChips}>
            <Chip label="Any hub" selected={!criteria.hubId} onPress={() => selectHub(null)} />
            {originHubs.map((h) => (
              <Chip key={h.id} label={h.name} selected={criteria.hubId === h.id} onPress={() => selectHub(h.id)} />
            ))}
            {originHubs.length === 0 && <Text style={styles.dim}>No approved hubs in this city yet.</Text>}
          </View>
        )}

        {/* Departures */}
        <Text style={[styles.groupLabel, { marginTop: space.lg }]}>Departures</Text>
        {trips.loading && <Loading />}
        {trips.error && <ErrorRow message={trips.error} onRetry={trips.reload} />}
        {trips.data && trips.data.length === 0 && (
          <EmptyState title="No departures match">Try another day, switch direction, or choose “Any hub”.</EmptyState>
        )}
        {trips.data && trips.data.length > 0 && (
          <View style={styles.list}>
            {trips.data.map((t, i) => {
              const stops = [...t.stops].sort((a, b) => a.stopOrder - b.stopOrder);
              const pickup = stops.find((s) => s.hubId === criteria.hubId) ?? stops[0];
              return (
                <View key={t.id}>
                  {i > 0 && <Separator inset={72} />}
                  <DepartureRow
                    trip={t}
                    pickup={pickup}
                    seatsNeeded={criteria.passengers}
                    onPress={() => router.push(`/book/${t.id}?hub=${pickup?.hubId ?? ''}&pax=${criteria.passengers}`)}
                  />
                </View>
              );
            })}
          </View>
        )}
        <Text style={styles.footNote}>
          Pickup time is when your bus reaches your hub — it differs from the origin departure. Times in Africa/Kampala.
        </Text>
      </BottomSheet>

      {/* Floating top bar (over the map) */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <View style={styles.brandRow}>
          <View style={styles.logo}><Text style={styles.logoText}>T</Text></View>
          <Text style={styles.brand}>To<Text style={{ color: colors.lime400 }}>Go</Text></Text>
          <View style={styles.modeTag}><Text style={styles.modeTagText}>{mode === 'connected' ? 'Connected' : 'Demo'}</Text></View>
        </View>
        <Pressable
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          hitSlop={8}
          style={styles.bell}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.forest700} />
          {unread > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>
          )}
        </Pressable>
      </View>

      {/* "Where are you going?" prompt — expands the sheet */}
      <Pressable
        onPress={() => sheet.current?.snapTo('expanded')}
        accessibilityRole="button"
        accessibilityLabel="Choose where you are going"
        style={[styles.goingBar, { top: insets.top + 54 }]}
      >
        <Ionicons name="search" size={18} color={colors.muted} />
        <View style={{ flex: 1 }}>
          <Text style={styles.goingTitle}>Where are you going?</Text>
          <Text style={styles.goingSub} numberOfLines={1}>{originCity} → {destCity} · {criteria.date === kampalaToday() ? 'Today' : formatDate(criteria.date)} · {criteria.passengers} pax</Text>
        </View>
        <Ionicons name="chevron-up" size={18} color={colors.forest600} />
      </Pressable>

      {mode === 'demo' && (
        <View style={[styles.demoWrap, { top: insets.top + 118 }]} pointerEvents="none">
          <DemoBadge />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapBase },
  mapLayer: { position: 'absolute', left: 0, right: 0, bottom: 0 },

  topBar: {
    position: 'absolute', left: 0, right: 0, top: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingBottom: 6,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  logo: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.lime400, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.forest900, fontWeight: '900', fontSize: 15 },
  brand: { color: colors.forest900, fontWeight: '900', fontSize: font.h2 },
  modeTag: { marginLeft: 2, backgroundColor: colors.forest100, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  modeTagText: { color: colors.forest700, fontSize: font.tiny, fontWeight: '800' },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.red600, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '800' },

  goingBar: {
    position: 'absolute', left: space.lg, right: space.lg,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.white, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#0f2619', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  goingTitle: { fontWeight: '800', color: colors.ink, fontSize: font.body },
  goingSub: { color: colors.muted, fontSize: font.small, marginTop: 1 },

  demoWrap: { position: 'absolute', left: space.lg, right: space.lg, borderRadius: radius.md, overflow: 'hidden' },

  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayChips: { flex: 1, flexDirection: 'row', gap: 6 },
  dayChip: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 9, alignItems: 'center', backgroundColor: colors.white },
  dayChipActive: { borderColor: colors.forest600, backgroundColor: colors.forest50 },
  dayChipText: { color: colors.inkSoft, fontWeight: '700', fontSize: font.small },
  dayChipTextActive: { color: colors.forest800 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white },
  stepBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepVal: { minWidth: 20, textAlign: 'center', fontSize: font.title, fontWeight: '800', color: colors.ink },

  resume: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.forest700, borderRadius: radius.lg, padding: space.md, marginBottom: space.md },
  resumeLabel: { color: colors.lime200, fontWeight: '800', fontSize: font.tiny, textTransform: 'uppercase', letterSpacing: 0.5 },
  resumeRef: { color: colors.white, fontWeight: '800', fontSize: font.body, marginTop: 2 },

  groupLabel: { fontSize: font.small, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.forest600, marginBottom: space.sm },
  hubChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dim: { color: colors.muted, fontSize: font.small },
  list: { backgroundColor: colors.white, borderRadius: radius.lg, paddingHorizontal: space.md },
  footNote: { color: colors.muted, fontSize: font.tiny, marginTop: space.md, lineHeight: 16 },
});
