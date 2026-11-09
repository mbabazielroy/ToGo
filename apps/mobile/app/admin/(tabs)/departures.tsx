import { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Group, Separator, Loading, ErrorRow, EmptyState, Segmented, PageHeader } from '@/components/ui';
import { AdminTripRow } from '@/admin/AdminTripRow';
import { useAdapter, useDataEpoch } from '@/data/AdapterProvider';
import { useAsync } from '@/hooks/useAsync';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, font, SCREEN, useColors, makeStyles } from '@/theme';
import { addDays, kampalaToday, formatDate } from '@shared/lib/time';
import type { DirectionCode } from '@shared/data/adapter';

type Dir = 'all' | DirectionCode;

export default function AdminDepartures() {
  const colors = useColors();
  const styles = useStyles();
  const adapter = useAdapter();
  const epoch = useDataEpoch();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = kampalaToday();
  const days = [0, 1, 2].map((d) => addDays(today, d));
  const [date, setDate] = useState(today);
  const [dir, setDir] = useState<Dir>('all');
  const [tick, setTick] = useState(0);

  const trips = useAsync(() => adapter.listTripsOn(date), [date, epoch, tick]);
  useFocusEffect(useCallback(() => { setTick((n) => n + 1); }, []));
  const list = useMemo(() => (trips.data ?? []).filter((t) => dir === 'all' || t.direction === dir), [trips.data, dir]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={{ paddingHorizontal: SCREEN }}>
        <PageHeader title="Departures" subtitle={`${list.length} on ${date === today ? 'today' : formatDate(date)}`}
          right={
            <Pressable onPress={() => router.push(`/admin/new-departure?date=${date}`)} accessibilityRole="button" accessibilityLabel="New departure" style={styles.add}>
              <Ionicons name="add" size={24} color={colors.white} />
            </Pressable>
          } />
        <View style={styles.days}>
          {days.map((d, i) => (
            <Pressable key={d} onPress={() => setDate(d)} accessibilityRole="button" accessibilityState={{ selected: d === date }} style={[styles.day, d === date && styles.dayOn]}>
              <Text style={[styles.dayText, d === date && styles.dayTextOn]}>{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatDate(d)}</Text>
            </Pressable>
          ))}
        </View>
        <Segmented segments={[{ value: 'all', label: 'Both ways' }, { value: 'KLA_MBR', label: 'KLA → MBR' }, { value: 'MBR_KLA', label: 'MBR → KLA' }]} value={dir} onChange={setDir} accessibilityLabel="Direction" />
      </View>
      <ScrollView contentContainerStyle={{ padding: SCREEN, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setTick((n) => n + 1)} tintColor={colors.forest700} />}>
        {trips.loading && !trips.data && <Loading />}
        {trips.error && <ErrorRow message={trips.error} onRetry={() => setTick((n) => n + 1)} />}
        {trips.data && list.length === 0 && <EmptyState title="No departures">Schedule one with the + button.</EmptyState>}
        {list.length > 0 && (
          <Group>
            {list.map((t, i) => (
              <View key={t.id}>
                {i > 0 && <Separator inset={SCREEN} />}
                <AdminTripRow trip={t} onPress={() => router.push(`/admin/trip/${t.id}`)} />
              </View>
            ))}
          </Group>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  add: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  days: { flexDirection: 'row', gap: 6, marginBottom: space.sm, flexWrap: 'wrap' },
  day: { borderRadius: 999, paddingHorizontal: 12, height: 34, justifyContent: 'center', backgroundColor: colors.surface },
  dayOn: { backgroundColor: colors.inverse },
  dayText: { fontSize: font.tiny, fontWeight: '700', color: colors.inkSoft },
  dayTextOn: { color: colors.onInverse },
}));
