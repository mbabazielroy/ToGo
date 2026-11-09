import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavBar, Group, Separator, SectionHeading, Segmented, PrimaryButton, Banner, Loading, LineBadge } from '@/components/ui';
import { useAdapter, useDataEpoch } from '@/data/AdapterProvider';
import { useAsync, humanError } from '@/hooks/useAsync';
import { useToast } from '@/components/ToastProvider';
import { haptics } from '@/lib/feedback';
import { lineFor } from '@/lib/lines';
import { space, font, SCREEN, radius, control, useColors, makeStyles } from '@/theme';
import { addDays, kampalaToday, formatDate, formatUGX } from '@shared/lib/time';
import type { DirectionCode } from '@shared/data/adapter';

const TIMES = ['06:00', '07:00', '08:30', '10:30', '12:00', '14:00', '15:30', '17:00'];

/** Schedule a departure: route, day and time, operator and vehicle, fare, and
 *  (optionally) crew. Validation mirrors the backend so errors show before submit. */
export default function NewDeparture() {
  const colors = useColors();
  const styles = useStyles();
  const adapter = useAdapter();
  const epoch = useDataEpoch();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string }>();
  const today = kampalaToday();
  const days = [0, 1, 2, 3, 4, 5, 6].map((d) => addDays(today, d));

  const operators = useAsync(() => adapter.listOperators(), [epoch]);
  const vehicles = useAsync(() => adapter.listVehicles(), [epoch]);
  const staff = useAsync(() => adapter.listStaff(), [epoch]);

  const [direction, setDirection] = useState<DirectionCode>('KLA_MBR');
  const [date, setDate] = useState(params.date && days.includes(params.date) ? params.date : today);
  const [time, setTime] = useState('07:00');
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [duration, setDuration] = useState('240');
  const [fare, setFare] = useState('25000');
  const [driverId, setDriverId] = useState<string | null>(null);
  const [conductorId, setConductorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!operatorId && operators.data?.length) setOperatorId(operators.data[0].id);
  }, [operators.data, operatorId]);
  const fleet = useMemo(() => (vehicles.data ?? []).filter((v) => v.operatorId === operatorId), [vehicles.data, operatorId]);
  useEffect(() => {
    if (!fleet.some((v) => v.id === vehicleId)) setVehicleId(fleet[0]?.id ?? null);
    setDriverId(null); setConductorId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorId, fleet.length]);

  const crew = (role: 'driver' | 'conductor') => (staff.data ?? []).filter((s) => s.role === role && s.operatorId === operatorId);
  const timeOk = /^([01]?\d|2[0-3]):[0-5]\d$/.test(time.trim());
  const past = date === today && timeOk && (() => {
    const [h, m] = time.split(':').map(Number);
    return new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+03:00`).getTime() < Date.now();
  })();
  const vehicle = fleet.find((v) => v.id === vehicleId);
  const fareNum = Number(fare.replace(/[^0-9]/g, ''));
  const durNum = Number(duration.replace(/[^0-9]/g, ''));

  async function submit() {
    if (!operatorId) return setError('Choose an operator.');
    if (!vehicleId) return setError('This operator has no vehicles yet.');
    if (!timeOk) return setError('Enter the departure time as HH:MM, e.g. 07:30.');
    if (past) return setError('That time has already passed today.');
    if (!durNum || durNum < 60) return setError('Journey time should be at least 60 minutes.');
    if (!fareNum || fareNum < 1000 || fareNum > 500000) return setError('Fares must be between UGX 1,000 and UGX 500,000.');
    if (durNum > 12 * 60) return setError('Journey time looks too long — enter minutes, e.g. 240 for four hours.');
    setError(null); setBusy(true);
    try {
      const trip = await adapter.createDeparture({ operatorId, vehicleId, direction, date, departHHMM: time.trim(), durationMin: durNum, fareUgx: fareNum, driverId, conductorId });
      haptics.success();
      toast('Departure scheduled. Passengers can book it now.', 'ok');
      router.replace(`/admin/trip/${trip.id}`);
    } catch (e) { haptics.warning(); setError(humanError(e)); }
    finally { setBusy(false); }
  }

  const loading = operators.loading || vehicles.loading;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NavBar title="New departure" onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
          {loading ? <Loading /> : (
            <>
              <SectionHeading title="Route" />
              <Segmented segments={[{ value: 'KLA_MBR', label: 'Kampala → Mbarara' }, { value: 'MBR_KLA', label: 'Mbarara → Kampala' }]} value={direction} onChange={setDirection} accessibilityLabel="Direction" />

              <SectionHeading title="Day" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {days.map((d, i) => (
                  <Chip key={d} label={i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatDate(d)} on={d === date} onPress={() => setDate(d)} />
                ))}
              </ScrollView>

              <SectionHeading title="Departure time" />
              <View style={styles.timeRow}>
                <TextInput style={[styles.timeInput, (!timeOk || past) && { borderColor: colors.red600 }]} value={time} onChangeText={setTime} placeholder="07:00" maxLength={5}
                  keyboardType="numbers-and-punctuation" accessibilityLabel="Departure time, 24-hour" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {TIMES.map((t) => <Chip key={t} label={t} on={t === time} onPress={() => setTime(t)} />)}
                </ScrollView>
              </View>
              {past && <Text style={styles.err}>That time has already passed today.</Text>}

              <SectionHeading title="Operator" />
              <Group>
                {(operators.data ?? []).map((o, i) => {
                  const line = lineFor(o.id, o.name);
                  return (
                    <View key={o.id}>
                      {i > 0 && <Separator inset={SCREEN} />}
                      <Pressable onPress={() => setOperatorId(o.id)} accessibilityRole="button" accessibilityState={{ selected: o.id === operatorId }} style={styles.opt}>
                        <LineBadge code={line.code} color={line.color} />
                        <Text style={styles.optText}>{o.name}</Text>
                        {o.id === operatorId && <Ionicons name="checkmark" size={22} color={colors.forest700} />}
                      </Pressable>
                    </View>
                  );
                })}
              </Group>

              <SectionHeading title="Vehicle" />
              {fleet.length === 0 ? <Banner tone="warn">This operator has no vehicles registered.</Banner> : (
                <Group>
                  {fleet.map((v, i) => (
                    <View key={v.id}>
                      {i > 0 && <Separator inset={SCREEN} />}
                      <Pressable onPress={() => setVehicleId(v.id)} accessibilityRole="button" accessibilityState={{ selected: v.id === vehicleId }} style={styles.opt}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.optText}>{v.label}</Text>
                          <Text style={styles.optSub}>{v.plate} · {v.seats} seats</Text>
                        </View>
                        {v.id === vehicleId && <Ionicons name="checkmark" size={22} color={colors.forest700} />}
                      </Pressable>
                    </View>
                  ))}
                </Group>
              )}

              <SectionHeading title="Fare & journey" />
              <Group>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Fare per seat (UGX)</Text>
                  <TextInput style={styles.input} value={fare} onChangeText={setFare} keyboardType="number-pad" accessibilityLabel="Fare per seat in UGX" />
                </View>
                <Separator inset={SCREEN} />
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Journey time (minutes)</Text>
                  <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="number-pad" accessibilityLabel="Journey time in minutes" />
                </View>
              </Group>

              <SectionHeading title="Crew (optional)" />
              <Group style={{ padding: space.md, gap: space.md }}>
                <CrewChoice label="Driver" people={crew('driver')} value={driverId} onChange={setDriverId} />
                <CrewChoice label="Conductor" people={crew('conductor')} value={conductorId} onChange={setConductorId} />
              </Group>

              {error && <View style={{ marginTop: space.lg }}><Banner tone="error">{error}</Banner></View>}
            </>
          )}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          {vehicle && fareNum > 0 && (
            <Text style={styles.summary}>{vehicle.seats} seats · up to {formatUGX(vehicle.seats * fareNum)} if full</Text>
          )}
          <PrimaryButton title="Schedule departure" icon="checkmark" onPress={submit} loading={busy} disabled={loading} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function CrewChoice({ label, people, value, onChange }: { label: string; people: { id: string; name: string }[]; value: string | null; onChange: (v: string | null) => void }) {
  const styles = useStyles();
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {people.length === 0 ? <Text style={styles.optSub}>No {label.toLowerCase()}s on this operator’s crew — assign later.</Text> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="Later" on={!value} onPress={() => onChange(null)} />
          {people.map((p) => <Chip key={p.id} label={p.name} on={value === p.id} onPress={() => onChange(p.id)} />)}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  chip: { borderRadius: 999, paddingHorizontal: 12, height: 34, justifyContent: 'center', backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.inverse },
  chipText: { fontSize: font.tiny, fontWeight: '700', color: colors.inkSoft },
  chipTextOn: { color: colors.onInverse },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  timeInput: { width: 92, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, textAlign: 'center', fontSize: font.title, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  err: { color: colors.red700, fontSize: font.tiny, marginTop: 4, paddingHorizontal: space.xs },
  opt: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: SCREEN, minHeight: control.height + 4, paddingVertical: 8 },
  optText: { flex: 1, fontSize: font.body, color: colors.ink, fontWeight: '600' },
  optSub: { fontSize: font.tiny, color: colors.muted, marginTop: 1 },
  field: { paddingHorizontal: SCREEN, paddingTop: 10, paddingBottom: 2 },
  fieldLabel: { fontSize: font.tiny, color: colors.muted, fontWeight: '600' },
  input: { fontSize: font.body, color: colors.ink, paddingVertical: 8, minHeight: control.small, fontWeight: '600' },
  footer: { paddingHorizontal: SCREEN, paddingTop: space.md, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, gap: 6 },
  summary: { fontSize: font.tiny, color: colors.muted, textAlign: 'center' },
}));
