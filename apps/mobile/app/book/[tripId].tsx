import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Muted, Label, PrimaryButton, Loading, ErrorRow, Separator } from '../../src/components/ui';
import { useAdapter, useAppMode } from '../../src/data/AdapterProvider';
import { useAsync, humanError } from '../../src/hooks/useAsync';
import { useToast } from '../../src/components/ToastProvider';
import { haptics } from '../../src/lib/feedback';
import { colors, radius, space, font, SCREEN, control } from '../../src/theme';
import { formatDate, formatTime, formatUGX } from '@shared/lib/time';
import { tripJourney, dropoffStopFor } from '@shared/data/journey';

function makeIdemKey() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function BookScreen() {
  const { tripId, hub, pax } = useLocalSearchParams<{ tripId: string; hub?: string; pax?: string }>();
  const adapter = useAdapter();
  const mode = useAppMode();
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
  const journey = t ? tripJourney(t, hub ?? null) : null;
  const dropoff = t ? dropoffStopFor(t) : undefined;
  const total = t ? t.fareUgx * seats : 0;
  const soldOut = !!t && t.seatsAvailable < 1;

  async function confirm() {
    if (busy || !t || !journey?.pickup || !dropoff) return;
    setErr(null); setBusy(true);
    try {
      const booking = await adapter.reserve({
        tripId: t.id, pickupStopId: journey.pickup.id, dropoffStopId: dropoff.id,
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
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.topTitle}>Review &amp; reserve</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 8}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: SCREEN, paddingTop: space.md, paddingBottom: space.xxl * 2, gap: space.lg }} keyboardShouldPersistTaps="handled">
          {trip.loading && <Loading />}
          {trip.error && <ErrorRow message={trip.error} onRetry={trip.reload} />}
          {t && journey?.pickup && (
            <>
              {/* Journey summary — pickup, destination, operator, date, times */}
              <View style={styles.summary}>
                <Text style={styles.summaryMeta}>{t.operatorName} · {formatDate(t.serviceDate)}</Text>
                <View style={styles.leg}>
                  <View style={styles.legIcon}><View style={styles.dotPickup} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.legPlace}>{journey.pickup.hubName}</Text>
                    <Text style={styles.legSub}>{journey.originCity} · Pickup</Text>
                  </View>
                  <Text style={styles.legTime}>{formatTime(journey.pickupTimeISO)}</Text>
                </View>
                <View style={styles.legLine} />
                <View style={styles.leg}>
                  <View style={styles.legIcon}><Ionicons name="flag" size={14} color={colors.forest700} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.legPlace}>{journey.destinationCity}</Text>
                    <Text style={styles.legSub}>Estimated arrival</Text>
                  </View>
                  <Text style={styles.legTime}>{formatTime(journey.arrivalTimeISO)}</Text>
                </View>
              </View>

              {/* Passenger details */}
              <View style={{ gap: space.md }}>
                <Text style={styles.section}>Passenger details</Text>
                <View>
                  <Label>Lead passenger name</Label>
                  <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Amina N." placeholderTextColor={colors.muted} accessibilityLabel="Lead passenger name" returnKeyType="next" />
                </View>
                <View>
                  <Label>Phone (optional)</Label>
                  <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+256 7xx" keyboardType="phone-pad" placeholderTextColor={colors.muted} accessibilityLabel="Phone number, optional" />
                </View>
                <View style={styles.paxRow}>
                  <Label>Passengers</Label>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => setSeats((s) => Math.max(1, s - 1))} accessibilityRole="button" accessibilityLabel="Fewer passengers" style={styles.stepBtn}>
                      <Ionicons name="remove" size={20} color={colors.forest700} />
                    </Pressable>
                    <Text style={styles.stepVal} accessibilityLabel={`${seats} passengers`}>{seats}</Text>
                    <Pressable onPress={() => setSeats((s) => Math.min(Math.max(1, t.seatsAvailable), s + 1))} accessibilityRole="button" accessibilityLabel="More passengers" style={styles.stepBtn}>
                      <Ionicons name="add" size={20} color={colors.forest700} />
                    </Pressable>
                  </View>
                </View>
                <Muted style={{ fontSize: font.small }}>{t.seatsAvailable} seat{t.seatsAvailable === 1 ? '' : 's'} available</Muted>
              </View>

              {/* Fare */}
              <View style={{ gap: space.sm }}>
                <Text style={styles.section}>Fare</Text>
                <View style={styles.fareRow}><Text style={styles.fareL}>Fare per passenger</Text><Text style={styles.fareR}>{formatUGX(t.fareUgx)}</Text></View>
                <View style={styles.fareRow}><Text style={styles.fareL}>Passengers</Text><Text style={styles.fareR}>× {seats}</Text></View>
                <Separator />
                <View style={styles.fareRow}><Text style={styles.fareL}>Payment</Text><Text style={styles.fareR}>Pay at boarding</Text></View>
                <Muted style={{ fontSize: font.tiny }}>No payment is collected in this pilot.</Muted>
              </View>

              {err && <ErrorRow message={err} onRetry={confirm} />}
            </>
          )}
        </ScrollView>

        {t && journey?.pickup && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total{seats > 1 ? ` · ${seats} passengers` : ''}</Text>
              <Text style={styles.totalR}>{formatUGX(total)}</Text>
            </View>
            <PrimaryButton title={soldOut ? 'Sold out' : 'Confirm reservation'} onPress={confirm} loading={busy} disabled={soldOut} />
            {mode === 'demo' && <Text style={styles.demoNote}>Demo reservation — no real seat booked.</Text>}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingVertical: space.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: font.title, fontWeight: '800', color: colors.ink },

  summary: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, padding: space.lg },
  summaryMeta: { color: colors.muted, fontSize: font.small, marginBottom: space.md },
  leg: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  legIcon: { width: 20, alignItems: 'center' },
  dotPickup: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.lime500 },
  legLine: { width: 2, height: 18, backgroundColor: colors.separator, marginLeft: 9, marginVertical: 2 },
  legPlace: { fontSize: font.body, fontWeight: '700', color: colors.ink },
  legSub: { fontSize: font.small, color: colors.muted, marginTop: 1 },
  legTime: { fontSize: font.title, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },

  section: { fontSize: font.small, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, minHeight: control.height, fontSize: font.body, color: colors.ink, backgroundColor: colors.surface },
  paxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  stepBtn: { width: 46, height: control.height, alignItems: 'center', justifyContent: 'center' },
  stepVal: { width: 36, textAlign: 'center', fontSize: font.h2, fontWeight: '800', color: colors.ink },

  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fareL: { color: colors.inkSoft, fontSize: font.body },
  fareR: { color: colors.ink, fontWeight: '700', fontSize: font.body },

  footer: { backgroundColor: colors.surface, paddingHorizontal: SCREEN, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, gap: space.sm },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontWeight: '700', fontSize: font.body, color: colors.ink },
  totalR: { fontWeight: '900', fontSize: font.h1, color: colors.ink, fontVariant: ['tabular-nums'] },
  demoNote: { textAlign: 'center', color: colors.muted, fontSize: font.tiny },
});
