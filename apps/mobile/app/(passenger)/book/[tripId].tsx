import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavBar, Group, PrimaryButton, Loading, ErrorRow, Separator, SectionHeading } from '@/components/ui';
import { useAdapter, useAppMode, useDataEpoch } from '@/data/AdapterProvider';
import { useAuth } from '@/auth/AuthProvider';
import { useSession } from '@/session/SessionProvider';
import { LineBadge } from '@/components/ui';
import { lineFor } from '@/lib/lines';
import { useAsync, humanError } from '@/hooks/useAsync';
import { useToast } from '@/components/ToastProvider';
import { haptics } from '@/lib/feedback';
import { useNow } from '@/hooks/useNow';
import { colors, space, font, SCREEN, control } from '@/theme';
import { formatDate, formatTime, formatUGX } from '@shared/lib/time';
import { tripJourney, dropoffStopFor } from '@shared/data/journey';
import { phoneLooksValid, PHONE_HINT } from '@/lib/validate';
import { reported } from '@/lib/crashReporting';

function makeIdemKey() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function BookScreen() {
  const { tripId, hub, pax } = useLocalSearchParams<{ tripId: string; hub?: string; pax?: string }>();
  const adapter = useAdapter();
  const mode = useAppMode();
  const { session, profile: account } = useAuth();
  const { profile, updateProfile } = useSession();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const epoch = useDataEpoch();
  const trip = useAsync(() => adapter.getTrip(String(tripId)), [tripId, epoch]);
  // Connected mode reserves against real accounts — require sign-in first.
  const needsAuth = mode === 'connected' && !session;

  const accountName = account?.full_name && account.full_name !== 'Traveller' ? account.full_name : '';
  const [name, setName] = useState(profile.name || accountName);
  const [phone, setPhone] = useState(profile.phone || account?.phone || '');
  // The account may load after this screen opens (e.g. right after signing in).
  useEffect(() => {
    if (!name && accountName) setName(accountName);
    if (!phone && account?.phone) setPhone(account.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountName, account?.phone]);
  const [seats, setSeats] = useState(Math.max(1, Math.min(5, Number(pax) || 1)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [idemKey] = useState(makeIdemKey);

  const t = trip.data;
  const journey = t ? tripJourney(t, hub ?? null) : null;
  const dropoff = t ? dropoffStopFor(t) : undefined;
  const total = t ? t.fareUgx * seats : 0;
  const soldOut = !!t && t.seatsAvailable < 1;
  const now = useNow(30000);
  // The bus has left (or is long overdue at) this pickup hub — don't let people book it.
  const left = !!journey?.pickup && (journey.pickup.reached
    || (t?.status === 'scheduled' && new Date(journey.pickupTimeISO).getTime() < now.getTime() - 10 * 60000)
    || t?.status === 'completed' || t?.status === 'cancelled');

  async function confirm() {
    if (busy || !t || !journey?.pickup || !dropoff || left) return;
    // Never reserve before authentication — send the passenger to sign in and
    // return to this exact journey (trip + hub + passengers preserved in the URL).
    if (needsAuth) {
      const back = `/book/${t.id}?hub=${hub ?? ''}&pax=${seats}`;
      router.push(`/auth?next=${encodeURIComponent(back)}`);
      return;
    }
    if (!name.trim()) { setErr('Add the lead passenger’s name — the conductor checks it at boarding.'); return; }
    if (!phoneLooksValid(phone)) { setErr(PHONE_HINT); return; }
    setErr(null); setBusy(true);
    try {
      const booking = await adapter.reserve({
        tripId: t.id, pickupStopId: journey.pickup.id, dropoffStopId: dropoff.id,
        seats, passengerName: name.trim() || 'Traveller', passengerPhone: phone.trim() || undefined,
        idempotencyKey: idemKey,
      });
      haptics.success();
      // Remember the name for next time if the profile didn't have one yet.
      if (!profile.name.trim()) updateProfile({ name: name.trim(), ...(profile.phone ? {} : { phone: phone.trim() }) }).catch(reported('save-name'));
      toast(`Reserved — ${booking.reference}`, 'ok');
      router.replace(`/trip/${booking.id}`);
    } catch (e) { haptics.warning(); setErr(humanError(e)); setBusy(false); }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NavBar title="Review trip" onBack={() => router.back()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 4}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
          {trip.loading && <Loading />}
          {trip.error && <ErrorRow message={trip.error} onRetry={trip.reload} />}
          {t && journey?.pickup && (
            <>
              <SectionHeading title="Journey" />
              <Group style={{ padding: space.lg }}>
                <View style={styles.summaryTop}>
                  <LineBadge code={lineFor(t.operatorId, t.operatorName).code} color={lineFor(t.operatorId, t.operatorName).color} />
                  <Text style={styles.summaryMeta}>{t.operatorName}{t.vehicleLabel ? ` · ${t.vehicleLabel}` : ''} · {formatDate(t.serviceDate)}</Text>
                </View>
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
                  <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Lead passenger name" placeholderTextColor={colors.muted} accessibilityLabel="Lead passenger name" returnKeyType="next" autoCapitalize="words" textContentType="name" />
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
              <Text style={styles.hint}>Pay the conductor when you board. You can cancel free of charge any time before boarding.</Text>

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
            {left && <Text style={styles.leftNote}>{t?.status === 'cancelled' ? 'This departure was cancelled.' : `This bus has already left ${journey?.pickup?.hubName ?? 'this hub'}. Pick a later departure.`}</Text>}
            <PrimaryButton title={left ? 'Departure closed' : soldOut ? 'Sold out' : needsAuth ? 'Sign in to reserve' : 'Confirm reservation'} onPress={confirm} loading={busy} disabled={soldOut || left} />
            {mode === 'demo' && <Text style={styles.demoNote}>Preview reservation — no real seat booked.</Text>}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.md },
  summaryMeta: { flex: 1, color: colors.muted, fontSize: font.small },
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
  leftNote: { color: colors.red700, fontSize: font.small, fontWeight: '600', textAlign: 'center' },
  demoNote: { textAlign: 'center', color: colors.muted, fontSize: font.tiny },
});
