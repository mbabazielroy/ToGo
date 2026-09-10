import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card, H1, Muted, Loading, ErrorRow, SectionHeading } from '../../src/components/ui';
import { useAdapter, useDataEpoch } from '../../src/data/AdapterProvider';
import { useAsync } from '../../src/hooks/useAsync';
import { colors, radius, space, font } from '../../src/theme';
import type { HubView } from '@shared/data/adapter';

export default function Hubs() {
  const adapter = useAdapter();
  const epoch = useDataEpoch();
  const hubs = useAsync(() => adapter.listHubs(), [epoch]);
  const cities = ['Kampala', 'Mbarara'];

  return (
    <Screen>
      <H1>Pickup hubs</H1>
      <Muted>Physical points where your bus meets you. Choose the one nearest you.</Muted>
      <View style={styles.note}>
        <Ionicons name="information-circle" size={16} color={colors.forest500} />
        <Text style={styles.noteText}>Illustrative demo locations — not officially approved sites or partnered businesses.</Text>
      </View>

      {hubs.loading && <Loading />}
      {hubs.error && <ErrorRow message={hubs.error} onRetry={hubs.reload} />}
      {cities.map((city) => {
        const list = (hubs.data ?? []).filter((h: HubView) => h.city === city);
        if (list.length === 0) return null;
        return (
          <View key={city}>
            <SectionHeading title={city} />
            <View style={{ gap: 10 }}>
              {list.map((h) => {
                const facilities = Object.entries(h.facilities ?? {}).filter(([, v]) => v).map(([k]) => k);
                return (
                  <Card key={h.id} style={styles.hubCard}>
                    <View style={styles.pin}><Ionicons name="location" size={20} color={colors.forest700} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{h.name}</Text>
                      <Text style={styles.area}>{h.area}</Text>
                      {h.openingHours ? <Text style={styles.meta}>{facilities.length} facilities · {h.openingHours}</Text> : null}
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.lime50, borderRadius: radius.md, padding: space.sm },
  noteText: { flex: 1, color: colors.forest700, fontSize: font.tiny },
  hubCard: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  pin: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.forest100, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '800', color: colors.forest900, fontSize: font.body },
  area: { color: colors.muted, fontSize: font.small },
  meta: { color: colors.forest500, fontSize: font.tiny, marginTop: 2 },
});
