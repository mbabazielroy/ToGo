import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { PageHeader, Muted, Loading, ErrorRow, SectionHeading, Separator, EmptyState } from '@/components/ui';
import { useAdapter, useAppMode, useDataEpoch } from '@/data/AdapterProvider';
import { useAsync } from '@/hooks/useAsync';
import { colors, radius, space, font } from '@/theme';
import type { HubView } from '@shared/data/adapter';

export default function Hubs() {
  const adapter = useAdapter();
  const router = useRouter();
  const epoch = useDataEpoch();
  const hubs = useAsync(() => adapter.listHubs(), [epoch]);
  const mode = useAppMode();
  const cities = ['Kampala', 'Mbarara'];

  return (
    <Screen showHeader={false}>
      <PageHeader title="Hubs" subtitle="Where your bus picks you up. Tap a hub for directions and facilities."
        right={
          <Pressable onPress={() => router.push('/map')} accessibilityRole="button" accessibilityLabel="Open live map" style={styles.mapBtn}>
            <Ionicons name="map" size={16} color={colors.white} />
            <Text style={styles.mapBtnText}>Map</Text>
          </Pressable>
        } />

      {hubs.loading && <Loading />}
      {hubs.error && <ErrorRow message={hubs.error} onRetry={hubs.reload} />}
      {!hubs.loading && !hubs.error && (hubs.data?.length ?? 0) === 0 && (
        <EmptyState title="Pickup locations are being added">Approved pickup hubs will appear here as operators set them up.</EmptyState>
      )}
      {cities.map((city) => {
        const list = (hubs.data ?? []).filter((h: HubView) => h.city === city);
        if (list.length === 0) return null;
        return (
          <View key={city}>
            <SectionHeading title={city} />
            <View style={styles.list}>
              {list.map((h, i) => {
                const facilities = Object.entries(h.facilities ?? {}).filter(([, v]) => v).length;
                return (
                  <View key={h.id}>
                    {i > 0 && <Separator inset={42} />}
                    <Pressable
                      onPress={() => router.push(`/hub/${h.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${h.name}, ${h.area}. View hub details.`}
                      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.forest50 }]}
                    >
                      <View style={styles.pin}><Ionicons name="location-outline" size={20} color={colors.forest700} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{h.name}</Text>
                        <Text style={styles.area} numberOfLines={1}>{h.area}</Text>
                        {h.openingHours ? <Text style={styles.meta}>{facilities} facilities · {h.openingHours}</Text> : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
      {mode === 'demo' && <Muted style={{ fontSize: font.tiny }}>Preview locations — sample hubs for trying the app.</Muted>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.forest700, borderRadius: 999, paddingHorizontal: 14, height: 36, marginBottom: 6 },
  mapBtnText: { color: colors.white, fontWeight: '700', fontSize: font.small },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space.md, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: space.md },
  pin: { width: 30, alignItems: 'center' },
  name: { fontWeight: '600', color: colors.ink, fontSize: font.body },
  area: { color: colors.muted, fontSize: font.small, marginTop: 1 },
  meta: { color: colors.muted, fontSize: font.tiny, marginTop: 2 },
});
