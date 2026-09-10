import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, H2, Muted, Label, PrimaryButton, Loading, ErrorRow } from '../../src/components/ui';
import { useAdapter } from '../../src/data/AdapterProvider';
import { useAsync, humanError } from '../../src/hooks/useAsync';
import { useToast } from '../../src/components/ToastProvider';
import { haptics } from '../../src/lib/feedback';
import { colors, radius, space, font, shadow } from '../../src/theme';
import { formatDate, formatTime, formatUGX } from '@shared/lib/time';

function makeIdemKey() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function BookScreen() {
  const { tripId, hub, pax } = useLocalSearchParams<{ tripId: string; hub?: string; pax?: string }>();
  const adapter = useAdapter();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
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
  const total = t ? t.fareUgx * seats : 0;
  const soldOut = !!t && t.seatsAvailable < 1;

  async function confirm() {
    if (busy || !t || !pickup || !dropoff) return;
    setErr(null); setBusy(true);
    try {
      const booking = await adapter.reserve({
        tripId: t.id, pickupStopId: pickup.id, dropoffStopId: dropoff.id,
        seats, passengerName: name.trim() || 'Traveller', passengerPhone: phone.trim() || undefined,
        idempotencyKey: idemKey,
      });
      haptics.success();
      toast(`Reserved — ${booking.reference}`, 'ok');
      router.replace(`/trip/${booking.id}`);
    } catch (e) { haptics.warning(); setErr(humanError(e)); setBusy(false); }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to search" hitSlop={8} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={colors.forest700} />
        </Pressable>
        <Text style={styles.topTitle}>Review &amp; reserve</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 8}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}
          keyboardShouldPersistTaps="handled"
        >
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
                <Text style={styles.hint}>Pickup time is when your bus reaches your hub, not the origin departure.</Text>
              </Card>

              <Card style={{ gap: 12 }}>
                <H2>Passenger details</H2>
                <View>
                  <Label>Lead passenger name</Label>
                  <TextInput
                    style={styles.input} value={name} onChangeText={setName}
                    placeholder="Amina N." placeholderTextColor={colors.muted}
                    accessibilityLabel="Lead passenger name" returnKeyType="next"
                  />
                </View>
                <View>
                  <Label>Phone (optional)</Label>
                  <TextInput
                    style={styles.input} value={phone} onChangeText={setPhone}
                    placeholder="+256 7xx" keyboardType="phone-pad" placeholderTextColor={colors.muted}
                    accessibilityLabel="Phone number, optional"
                  />
                </View>
                <View>
                  <Label>Passengers</Label>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => setSeats((s) => Math.max(1, s - 1))} accessibilityRole="button" accessibilityLabel="Fewer passengers" style={styles.stepBtn}>
                      <Ionicons name="remove" size={20} color={colors.forest700} />
                    </Pressable>
                    <Text style={styles.stepVal} accessibilityLabel={`${seats} passengers`}>{seats}</Text>
                    <Pressable onPress={() => setSeats((s) => Math.min(Math.max(1, t.seatsAvailable), s + 1))} accessibilityRole="button" accessibilityLabel="More passengers" style={styles.stepBtn}>
                      <Ionicons name="add" size={20} color={colors.forest700} />
                    </Pressable>
                    <Muted style={{ marginLeft: 10, fontSize: font.small }}>{t.seatsAvailable} available</Muted>
                  </View>
                </View>
              </Card>

              <Card style={{ gap: 8 }}>
                <H2>Fare</H2>
                <Row l="Fare per passenger" r={formatUGX(t.fareUgx)} />
                <Row l="Passengers" r={`× ${seats}`} />
                <View style={styles.payRow}>
                  <Ionicons name="wallet-outline" size={18} color={colors.forest700} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payTitle}>Reserve now — pay at boarding</Text>
                    <Muted style={{ fontSize: font.tiny }}>No payment is collected in this pilot.</Muted>
                  </View>
                </View>
              </Card>

              {err && <ErrorRow message={err} onRetry={confirm} />}
              <Muted style={{ textAlign: 'center', fontSize: font.tiny }}>
                Demo pilot reservation — no money changes hands and pickup is not guaranteed.
              </Muted>
            </>
          )}
        </ScrollView>

        {/* Sticky action: total fare above the button, kept above the safe area / keyboard */}
        {t && pickup && dropoff && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>Total{seats > 1 ? ` · ${seats} passengers` : ''}</Text>
                <Text style={styles.totalHint}>Pay at boarding</Text>
              </View>
              <Text style={styles.totalR}>{formatUGX(total)}</Text>
            </View>
            <PrimaryButton
              title={soldOut ? 'Sold out' : 'Confirm reservation'}
              onPress={confirm}
              loading={busy}
              disabled={soldOut}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
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
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Muted style={{ fontSize: font.body }}>{l}</Muted><Text style={{ color: colors.ink, fontWeight: '700' }}>{r}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sand100 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingVertical: space.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: font.title, fontWeight: '800', color: colors.forest900 },
  op: { fontWeight: '800', color: colors.forest900, fontSize: font.body },
  hint: { color: colors.muted, fontSize: font.tiny, marginTop: 2 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: font.body, color: colors.ink, minHeight: 48, backgroundColor: colors.white },
  stepper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 4, backgroundColor: colors.white },
  stepBtn: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.forest50, alignItems: 'center', justifyContent: 'center' },
  stepVal: { width: 40, textAlign: 'center', fontSize: font.h2, fontWeight: '800', color: colors.ink },
  dashLine: { marginLeft: 15, height: 16, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: colors.forest200 },
  jIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  jTitle: { fontWeight: '700', color: colors.forest900, fontSize: font.body },
  jTime: { fontWeight: '800', color: colors.forest900 },
  jLabel: { fontSize: font.tiny, color: colors.forest500, textTransform: 'uppercase' },
  payRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.forest50, borderRadius: radius.md, padding: 12, marginTop: 2 },
  payTitle: { fontWeight: '700', color: colors.forest900 },
  footer: { backgroundColor: colors.white, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, gap: space.sm, ...shadow.sheet },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontWeight: '800', fontSize: font.body, color: colors.ink },
  totalHint: { fontSize: font.tiny, color: colors.muted, marginTop: 1 },
  totalR: { fontWeight: '900', fontSize: font.h1, color: colors.forest900 },
});
