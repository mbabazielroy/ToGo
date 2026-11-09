import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Group, Separator, SectionHeading, Loading, ErrorRow, PageHeader, LineBadge, Segmented } from '@/components/ui';
import { useAdapter, useDataEpoch } from '@/data/AdapterProvider';
import { useAsync } from '@/hooks/useAsync';
import { lineFor } from '@/lib/lines';
import { space, font, SCREEN, useColors, makeStyles } from '@/theme';
import { useState } from 'react';

const FAC: Record<string, keyof typeof Ionicons.glyphMap> = {
  shelter: 'home-outline', seating: 'browsers-outline', toilets: 'water-outline', attendant: 'person-outline', water: 'cafe-outline', lighting: 'bulb-outline',
};

/** The network: pickup hubs by city, and operators with their fleets. */
export default function AdminNetwork() {
  const colors = useColors();
  const styles = useStyles();
  const adapter = useAdapter();
  const epoch = useDataEpoch();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'hubs' | 'operators'>('hubs');
  const hubs = useAsync(() => adapter.listHubs(), [epoch]);
  const operators = useAsync(() => adapter.listOperators(), [epoch]);
  const vehicles = useAsync(() => adapter.listVehicles(), [epoch]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: space.xxl }}>
        <PageHeader title="Network" subtitle="Hubs, operators and fleet" />
        <Segmented segments={[{ value: 'hubs', label: `Hubs${hubs.data ? ` · ${hubs.data.length}` : ''}` }, { value: 'operators', label: `Operators${operators.data ? ` · ${operators.data.length}` : ''}` }]} value={tab} onChange={setTab} />

        {tab === 'hubs' && (
          <>
            {hubs.loading && <Loading />}
            {hubs.error && <ErrorRow message={hubs.error} onRetry={hubs.reload} />}
            {['Kampala', 'Mbarara'].map((city) => {
              const list = (hubs.data ?? []).filter((h) => h.city === city);
              if (!list.length) return null;
              return (
                <View key={city}>
                  <SectionHeading title={city} />
                  <Group>
                    {list.map((h, i) => (
                      <View key={h.id}>
                        {i > 0 && <Separator inset={SCREEN} />}
                        <View style={styles.hub}>
                          <Text style={styles.name}>{h.name}</Text>
                          <Text style={styles.meta}>{h.area}</Text>
                          {h.openingHours ? <Text style={styles.meta}>Open {h.openingHours}</Text> : null}
                          <View style={styles.facs}>
                            {Object.entries(h.facilities ?? {}).filter(([, v]) => v).map(([k]) => (
                              <View key={k} style={styles.fac}><Ionicons name={FAC[k] ?? 'checkmark'} size={12} color={colors.forest700} /><Text style={styles.facText}>{k}</Text></View>
                            ))}
                          </View>
                        </View>
                      </View>
                    ))}
                  </Group>
                </View>
              );
            })}
          </>
        )}

        {tab === 'operators' && (
          <>
            {operators.loading && <Loading />}
            {operators.error && <ErrorRow message={operators.error} onRetry={operators.reload} />}
            {(operators.data ?? []).map((o) => {
              const line = lineFor(o.id, o.name);
              const fleet = (vehicles.data ?? []).filter((v) => v.operatorId === o.id);
              return (
                <View key={o.id}>
                  <View style={styles.opHead}>
                    <LineBadge code={line.code} color={line.color} />
                    <Text style={styles.opName}>{o.name}</Text>
                    <Ionicons name="star" size={12} color={colors.amber600} />
                    <Text style={styles.meta}>{o.rating.toFixed(1)}</Text>
                  </View>
                  <Group>
                    {fleet.length === 0 && <Text style={[styles.meta, { padding: SCREEN }]}>No vehicles registered.</Text>}
                    {fleet.map((v, i) => (
                      <View key={v.id}>
                        {i > 0 && <Separator inset={SCREEN} />}
                        <View style={styles.veh}>
                          <Ionicons name="bus-outline" size={18} color={line.color} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.name}>{v.label}</Text>
                            <Text style={styles.meta}>{v.plate}</Text>
                          </View>
                          <Text style={styles.seats}>{v.seats} seats</Text>
                        </View>
                      </View>
                    ))}
                  </Group>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  hub: { paddingHorizontal: SCREEN, paddingVertical: space.md, gap: 2 },
  name: { fontSize: font.body, fontWeight: '700', color: colors.ink },
  meta: { fontSize: font.tiny, color: colors.muted },
  facs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  fac: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.forest100, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  facText: { fontSize: 11, color: colors.forest800, fontWeight: '600', textTransform: 'capitalize' },
  opHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.lg, marginBottom: space.sm, paddingHorizontal: space.xs },
  opName: { flex: 1, fontSize: font.body, fontWeight: '800', color: colors.ink },
  veh: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: SCREEN, paddingVertical: space.md },
  seats: { fontSize: font.small, fontWeight: '700', color: colors.inkSoft },
}));
