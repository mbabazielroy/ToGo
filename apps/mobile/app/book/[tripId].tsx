import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card, H1, H2, Muted, Label, PrimaryButton, Loading, ErrorRow } from '../../src/components/ui';
import { useAdapter } from '../../src/data/AdapterProvider';
import { useAsync, humanError } from '../../src/hooks/useAsync';
import { useToast } from '../../src/components/ToastProvider';
import { colors, radius, space, font } from '../../src/theme';
import { formatDate, formatTime, formatUGX } from '@shared/lib/time';

function makeIdemKey() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function BookScreen() {
  const { tripId, hub, pax } = useLocalSearchParams<{ tripId: string; hub?: string; pax?: string }>();
  const adapter = useAdapter();
  const router = useRouter();
  const toast = useToast();
  const trip = useAsync(() => adapter.getTrip(String(tripId)), [tripId]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [seats, setSeats] = useState(Math.max(1, Math.min(5, Number(pax) || 1)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [idemKey] = useState(makeIdemKey);

  const t = trip.data;
  const stops = t ? [...t.stops].sort((a, b) => a.stopOrder - b.stopOrder) : [];
  const pickup = stops.find((s) => s.hubId === hub) ?? stops[0];
  const dropoff = stops[stops.length - 1];

  async function confirm() {
    if (busy || !t || !pickup || !dropoff) return;
    setErr(null); setBusy(true);
    try {
      const booking = await adapter.reserve({
        tripId: t.id, pickupStopId: pickup.id, dropoffStopId: dropoff.id,
        seats, passengerName: name.trim() || 'Traveller', passengerPhone: phone.trim() || undefined,
        idempotencyKey: idemKey,
      });
      toast(`Reserved — ${booking.reference}`, 'ok');
      router.replace(`/trip/${booking.id}`);
    } catch (e) { setErr(humanError(e)); setBusy(false); }
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Ionicons name="chevron-back" size={18} color={colors.forest600} /><Text style={styles.backText}>Back to search</Text>
      </Pressable>
      <H1>Review &amp; reserve</H1>
      {trip.loading && <Loading />}
      {trip.error && <ErrorRow message={trip.error} onRetry={trip.reload} />}
      {t && pickup && dropoff && (
        <>
          <Card style={{ gap: 2 }}>
            <Text style={styles.op}>{t.operatorName}</Text>
            <Muted style={{ fontSize: font.small }}>{formatDate(t.serviceDate)} · departs origin {formatTime(t.originDeparture)}</Muted>
          </Card>

          <Card style={{ gap: 10 }}>
            <H2>Your journey</H2>
            <JourneyRow icon="location" accent title={pickup.hubName} sub={pickup.hubCity} time={formatTime(pickup.pickupTime)} tl="Pickup" />
            <View style={styles.dashLine} />
            <JourneyRow icon="flag" title={dropoff.hubName} sub={dropoff.hubCity} time={formatTime(dropoff.pickupTime)} tl="Arrive" />
          </Card>

          <Card style={{ gap: 12 }}>
            <H2>Passenger details</H2>
            <View><Label>Lead passenger name</Label>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Amina N." placeholderTextColor={colors.forest200} /></View>
            <View><Label>Phone (optional)</Label>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+256 7xx" keyboardType="phone-pad" placeholderTextColor={colors.forest200} /></View>
            <View>
              <Label>Passengers</Label>
              <View style={styles.stepper}>
                <Pressable onPress={() => setSeats((s) => Math.max(1, s - 1))} style={styles.stepBtn}><Text style={styles.stepSign}>−</Text></Pressable>
                <Text style={styles.stepVal}>{seats}</Text>
                <Pressable onPress={() => setSeats((s) => Math.min(Math.max(1, t.seatsAvailable), s + 1))} style={styles.stepBtn}><Text style={styles.stepSign}>+</Text></Pressable>
                <Muted style={{ marginLeft: 8, fontSize: font.small }}>{t.seatsAvailable} available</Muted>
              </View>
            </View>
          </Card>

          <Card style={{ gap: 8 }}>
            <H2>Fare</H2>
            <Row l="Fare per passenger" r={formatUGX(t.fareUgx)} />
            <Row l="Passengers" r={`× ${seats}`} />
            <View style={styles.totalRow}><Text style={styles.totalL}>Total</Text><Text style={styles.totalR}>{formatUGX(t.fareUgx * seats)}</Text></View>
            <View style={styles.payRow}>
              <Ionicons name="wallet" size={18} color={colors.forest700} />
              <View><Text style={styles.payTitle}>Reserve — pay at boarding</Text><Muted style={{ fontSize: font.tiny }}>No payment is collected now.</Muted></View>
            </View>
          </Card>

          {err && <ErrorRow message={err} onRetry={confirm} />}
          <PrimaryButton title="Confirm reservation" onPress={confirm} loading={busy} disabled={t.seatsAvailable < 1} />
          <Muted style={{ textAlign: 'center', fontSize: font.tiny }}>Demo pilot reservation — no money changes hands and pickup is not guaranteed.</Muted>
        </>
      )}
    </Screen>
  );
}

function JourneyRow({ icon, title, sub, time, tl, accent }: { icon: 'location' | 'flag'; title: string; sub?: string; time: string; tl: string; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={[styles.jIcon, { backgroundColor: accent ? colors.lime400 : colors.forest100 }]}>
        <Ionicons name={icon} size={16} color={accent ? colors.forest900 : colors.forest700} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.jTitle}>{title}</Text>
        {sub ? <Muted style={{ fontSize: font.small }}>{sub}</Muted> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}><Text style={styles.jTime}>{time}</Text><Text style={styles.jLabel}>{tl}</Text></View>
    </View>
  );
}
function Row({ l, r }: { l: string; r: string }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Muted style={{ fontSize: font.body }}>{l}</Muted><Text style={{ color: colors.forest800, fontWeight: '600' }}>{r}</Text></View>;
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: colors.forest600, fontWeight: '700', fontSize: font.small },
  op: { fontWeight: '800', color: colors.forest900, fontSize: font.body },
  input: { borderWidth: 1, borderColor: colors.forest200, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: font.body, color: colors.forest900, minHeight: 48 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.forest200, borderRadius: radius.md, padding: 4 },
  stepBtn: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.forest50, alignItems: 'center', justifyContent: 'center' },
  stepSign: { fontSize: 22, fontWeight: '800', color: colors.forest700 },
  stepVal: { width: 26, textAlign: 'center', fontSize: font.h2, fontWeight: '800', color: colors.forest900 },
  dashLine: { marginLeft: 15, height: 16, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: colors.forest200 },
  jIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  jTitle: { fontWeight: '700', color: colors.forest900, fontSize: font.body },
  jTime: { fontWeight: '800', color: colors.forest900 },
  jLabel: { fontSize: font.tiny, color: colors.forest500, textTransform: 'uppercase' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.forest100, paddingTop: 8, marginTop: 2 },
  totalL: { fontWeight: '800', fontSize: font.title, color: colors.forest900 },
  totalR: { fontWeight: '900', fontSize: font.title, color: colors.forest900 },
  payRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.forest50, borderRadius: radius.md, padding: 12 },
  payTitle: { fontWeight: '700', color: colors.forest900 },
});
