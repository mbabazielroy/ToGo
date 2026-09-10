import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { H1, Muted, Loading, ErrorRow, SectionHeading, Separator } from '../../src/components/ui';
import { useAdapter, useDataEpoch } from '../../src/data/AdapterProvider';
import { useAsync } from '../../src/hooks/useAsync';
import { colors, radius, space, font } from '../../src/theme';
import type { HubView } from '@shared/data/adapter';

export default function Hubs() {
  const adapter = useAdapter();
  const router = useRouter();
  const epoch = useDataEpoch();
  const hubs = useAsync(() => adapter.listHubs(), [epoch]);
  const cities = ['Kampala', 'Mbarara'];

  return (
    <Screen>
      <H1>Pickup hubs</H1>
      <Muted>Physical points where your bus meets you. Tap a hub for boarding details.</Muted>

      {hubs.loading && <Loading />}
      {hubs.error && <ErrorRow message={hubs.error} onRetry={hubs.reload} />}
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
                    {i > 0 && <Separator inset={56} />}
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
                      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
      <Muted style={{ fontSize: font.tiny }}>Illustrative demo locations — not officially approved sites or partnered businesses.</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, paddingHorizontal: space.md },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: space.md },
  pin: { width: 32, alignItems: 'center' },
  name: { fontWeight: '800', color: colors.ink, fontSize: font.body },
  area: { color: colors.muted, fontSize: font.small, marginTop: 1 },
  meta: { color: colors.muted, fontSize: font.tiny, marginTop: 2 },
});
