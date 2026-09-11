import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavBar, Group, Muted, PrimaryButton, Loading, ErrorRow, Separator, SectionHeading } from '../../src/components/ui';
import { useAdapter, useAppMode } from '../../src/data/AdapterProvider';
import { useAuth } from '../../src/auth/AuthProvider';
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
  const { session } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const trip = useAsync(() => adapter.getTrip(String(tripId)), [tripId]);
  // Connected mode reserves against real accounts — require sign-in first.
  const needsAuth = mode === 'connected' && !session;

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
    // Never reserve before authentication — send the passenger to sign in and
    // return to this exact journey (trip + hub + passengers preserved in the URL).
    if (needsAuth) {
      const back = `/book/${t.id}?hub=${hub ?? ''}&pax=${seats}`;
      router.push(`/auth?next=${encodeURIComponent(back)}`);
      return;
    }
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
      <NavBar title="Review" onBack={() => router.back()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 4}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
          {trip.loading && <Loading />}
          {trip.error && <ErrorRow message={trip.error} onRetry={trip.reload} />}
          {t && journey?.pickup && (
            <>
              <SectionHeading title="Journey" />
              <Group style={{ padding: space.lg }}>
                <Text style={styles.summaryMeta}>{t.operatorName} · {formatDate(t.serviceDate)}</Text>
                <View style={styles.leg}>
                  <View style={styles.legIcon}><View style={styles.dotPickup} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.legPlace} numberOfLines={1}>{journey.pickup.hubName}</Text>
                    <Text style={styles.legSub}>{journey.originCity} · Pickup</Text>
                  </View>
                  <Text style={styles.legTime}>{formatTime(journey.pickupTimeISO)}</Text>
                </View>
                <View style={styles.legLine} />
                <View style={styles.leg}>
                  <View style={styles.legIcon}><Ionicons name="flag" size={13} color={colors.forest700} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.legPlace}>{journey.destinationCity}</Text>
                    <Text style={styles.legSub}>Estimated arrival</Text>
                  </View>
                  <Text style={styles.legTime}>{formatTime(journey.arrivalTimeISO)}</Text>
                </View>
              </Group>

              <SectionHeading title="Passenger" />
              <Group>
                <View style={styles.fieldRow}>
                  <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Lead passenger name" placeholderTextColor={colors.muted} accessibilityLabel="Lead passenger name" returnKeyType="next" />
                </View>
                <Separator inset={SCREEN} />
                <View style={styles.fieldRow}>
                  <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone (optional)" keyboardType="phone-pad" placeholderTextColor={colors.muted} accessibilityLabel="Phone number, optional" />
                </View>
                <Separator inset={SCREEN} />
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Passengers</Text>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => setSeats((s) => Math.max(1, s - 1))} accessibilityRole="button" accessibilityLabel="Fewer passengers" style={styles.stepBtn}>
                      <Ionicons name="remove" size={20} color={seats <= 1 ? colors.faint : colors.forest700} />
                    </Pressable>
                    <Text style={styles.stepVal} accessibilityLabel={`${seats} passengers`}>{seats}</Text>
                    <Pressable onPress={() => setSeats((s) => Math.min(Math.max(1, t.seatsAvailable), s + 1))} accessibilityRole="button" accessibilityLabel="More passengers" style={styles.stepBtn}>
                      <Ionicons name="add" size={20} color={seats >= t.seatsAvailable ? colors.faint : colors.forest700} />
                    </Pressable>
                  </View>
                </View>
              </Group>
              <Text style={styles.hint}>{t.seatsAvailable} seat{t.seatsAvailable === 1 ? '' : 's'} available.</Text>

              <SectionHeading title="Fare" />
              <Group style={{ paddingHorizontal: SCREEN }}>
                <View style={styles.fareRow}><Text style={styles.fareL}>Fare per passenger</Text><Text style={styles.fareR}>{formatUGX(t.fareUgx)}</Text></View>
                <Separator />
                <View style={styles.fareRow}><Text style={styles.fareL}>Passengers</Text><Text style={styles.fareR}>× {seats}</Text></View>
                <Separator />
                <View style={styles.fareRow}><Text style={styles.fareL}>Payment</Text><Text style={styles.fareR}>Pay at boarding</Text></View>
              </Group>
              <Text style={styles.hint}>No payment is collected in this pilot.</Text>

              {err && <View style={{ marginTop: space.md }}><ErrorRow message={err} onRetry={confirm} /></View>}
            </>
          )}
        </ScrollView>

        {t && journey?.pickup && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total{seats > 1 ? ` · ${seats} passengers` : ''}</Text>
              <Text style={styles.totalR}>{formatUGX(total)}</Text>
            </View>
            <PrimaryButton title={soldOut ? 'Sold out' : needsAuth ? 'Sign in to reserve' : 'Confirm reservation'} onPress={confirm} loading={busy} disabled={soldOut} />
            {mode === 'demo' && <Text style={styles.demoNote}>Demo reservation — no real seat booked.</Text>}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  summaryMeta: { color: colors.muted, fontSize: font.small, marginBottom: space.md },
  leg: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  legIcon: { width: 18, alignItems: 'center' },
  dotPickup: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.forest700 },
  legLine: { width: StyleSheet.hairlineWidth * 2, height: 18, backgroundColor: colors.border, marginLeft: 8, marginVertical: 3 },
  legPlace: { fontSize: font.body, fontWeight: '600', color: colors.ink },
  legSub: { fontSize: font.small, color: colors.muted, marginTop: 1 },
  legTime: { fontSize: font.title, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },

  fieldRow: { paddingHorizontal: SCREEN, minHeight: control.row + 6, justifyContent: 'center' },
  input: { fontSize: font.body, color: colors.ink, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: control.row + 6, paddingHorizontal: SCREEN, paddingVertical: 6 },
  rowLabel: { fontSize: font.body, color: colors.ink, flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepVal: { minWidth: 26, textAlign: 'center', fontSize: font.body, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  hint: { color: colors.muted, fontSize: font.tiny, marginTop: space.xs, paddingHorizontal: space.xs },

  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: control.row, paddingVertical: 6 },
  fareL: { color: colors.ink, fontSize: font.body },
  fareR: { color: colors.inkSoft, fontSize: font.body },

  footer: { backgroundColor: colors.surface, paddingHorizontal: SCREEN, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, gap: space.sm },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontWeight: '400', fontSize: font.body, color: colors.inkSoft },
  totalR: { fontWeight: '700', fontSize: font.h2, color: colors.ink, fontVariant: ['tabular-nums'] },
  demoNote: { textAlign: 'center', color: colors.muted, fontSize: font.tiny },
});
