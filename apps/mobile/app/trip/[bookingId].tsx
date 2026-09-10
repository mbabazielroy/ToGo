import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Muted, PrimaryButton, Loading, ErrorRow, Separator } from '../../src/components/ui';
import { BookingStatusPill } from '../../src/components/StatusPill';
import { QRCode } from '../../src/components/QRCode';
import { useAdapter, useAppMode, useDataEpoch } from '../../src/data/AdapterProvider';
import { useAsync, humanError } from '../../src/hooks/useAsync';
import { useToast } from '../../src/components/ToastProvider';
import { haptics } from '../../src/lib/feedback';
import { colors, radius, space, font, SCREEN, control } from '../../src/theme';
import type { BookingStatusCode, TripStatusCode } from '@shared/data/adapter';
import { formatTime, formatUGX, timeAgo } from '@shared/lib/time';
import { tripJourney } from '@shared/data/journey';

interface Stage { key: string; label: string; hint: string }

function stageProgress(status: BookingStatusCode, tripStatus?: TripStatusCode): { reached: number; stalled: boolean } {
  switch (status) {
    case 'reserved': return { reached: 1, stalled: false };
    case 'checked_in': return { reached: 2, stalled: false };
    case 'boarded': return { reached: tripStatus === 'completed' ? 5 : 3, stalled: false };
    case 'completed': return { reached: 5, stalled: false };
    case 'missed_pickup': return { reached: 2, stalled: true };
    case 'not_boarded':
    case 'no_show': return { reached: 1, stalled: true };
    default: return { reached: 0, stalled: false }; // cancelled
  }
}

export default function TripScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const adapter = useAdapter();
  const mode = useAppMode();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const booking = useAsync(() => adapter.getBooking(String(bookingId)), [bookingId]);
  const b = booking.data;
  const trip = useAsync(() => (b ? adapter.getTrip(b.tripId) : Promise.resolve(null)), [b?.tripId]);
  const location = useAsync(() => (b ? adapter.latestLocation(b.tripId) : Promise.resolve(null)), [b?.tripId]);
  const t = trip.data;

  useEffect(() => {
    if (!b) return;
    const sub = adapter.subscribeTrip(b.tripId, () => { booking.reload(); trip.reload(); location.reload(); });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b?.tripId]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    if (busy) return;
    setBusy(true);
    try { await fn(); haptics.success(); toast(ok, 'ok'); booking.reload(); trip.reload(); }
    catch (e) { haptics.warning(); toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }
  function confirmCancel() {
    Alert.alert('Cancel reservation', 'Your seats will be released.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel reservation', style: 'destructive', onPress: () => act(() => adapter.cancelBooking(b!.id), 'Reservation cancelled') },
    ]);
  }

  const journey = useMemo(() => (t ? tripJourney(t, b?.pickupHubId) : null), [t, b?.pickupHubId]);
  const hubName = journey?.pickup?.hubName ?? 'your pickup hub';
  const destination = journey ? journey.destinationCity : (b?.reference ?? '');

  const stages: Stage[] = [
    { key: 'reserved', label: 'Reserved', hint: 'Your seat is held.' },
    { key: 'checkin', label: `Check in at ${hubName}`, hint: 'Check in when you reach your pickup hub.' },
    { key: 'board', label: 'Board', hint: 'Show your code to the conductor.' },
    { key: 'travel', label: `On the way to ${destination}`, hint: 'Your bus is en route.' },
    { key: 'arrive', label: `Arrived in ${destination}`, hint: 'Trip complete.' },
  ];

  const staleMs = location.data ? Date.now() - new Date(location.data.receivedAt).getTime() : 0;
  const stale = staleMs > 120000;

  const { reached, stalled } = b ? stageProgress(b.status, t?.status) : { reached: 0, stalled: false };
  const cancelled = b?.status === 'cancelled';
  const currentStage = !cancelled && !stalled && reached < stages.length ? stages[reached] : undefined;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.replace('/trips')} accessibilityRole="button" accessibilityLabel="Back to My Trips" hitSlop={8} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.topTitle}>Boarding pass</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        {booking.loading && <Loading />}
        {booking.error && <ErrorRow message={booking.error} onRetry={booking.reload} />}
        {b && (
          <View style={{ gap: space.md }}>
            {cancelled && <Banner tone="red" text="This reservation was cancelled and the seats released." />}
            {b.status === 'missed_pickup' && <Banner tone="amber" text="You checked in but were not boarded before the trip completed. Operations is investigating and will follow up." />}
            {(b.status === 'not_boarded' || b.status === 'no_show') && <Banner tone="sand" text="This trip has completed and you were not boarded, so you were not recorded as having travelled." />}

            {/* Ticket */}
            <View style={styles.ticket}>
              <View style={styles.ticketHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ticketKicker}>To</Text>
                  <Text style={styles.ticketDest} numberOfLines={1}>{destination}</Text>
                </View>
                <BookingStatusPill status={b.status} />
              </View>
              <View style={styles.ticketWhen}>
                <View>
                  <Text style={styles.pickupTime}>{formatTime(b.pickupTimeSnapshot)}</Text>
                  <Text style={styles.pickupCaption}>Pickup · {hubName}</Text>
                </View>
                {journey && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.arriveTime}>{formatTime(journey.arrivalTimeISO)}</Text>
                    <Text style={styles.pickupCaption}>Est. arrival</Text>
                  </View>
                )}
              </View>

              <View style={styles.qrBlock}>
                <QRCode value={`TOGO:${b.boardingCredential}`} size={148} />
              </View>
              <Text style={styles.code}>{b.reference}</Text>
              <Text style={styles.showCode}>Show this code to the conductor.</Text>

              <Separator />
              <View style={styles.ticketFoot}>
                <Text style={styles.footItem}>{b.seats} passenger{b.seats === 1 ? '' : 's'}</Text>
                <Text style={styles.footDot}>·</Text>
                <Text style={styles.footItem}>{formatUGX(b.fareUgxSnapshot * b.seats)}</Text>
                <Text style={styles.footDot}>·</Text>
                <Text style={styles.footItem}>Pay at boarding</Text>
              </View>
            </View>

            {/* Current step + next instruction */}
            {currentStage && (
              <View style={styles.stepNow}>
                <Text style={styles.stepNowLabel}>Step {reached + 1} of {stages.length}</Text>
                <Text style={styles.stepNowTitle}>{currentStage.label}</Text>
                <Text style={styles.stepNowHint}>{currentStage.hint}</Text>
                {b.status === 'reserved' && (
                  <View style={{ marginTop: space.md }}>
                    <PrimaryButton title="Check in" accent onPress={() => act(() => adapter.checkIn(b.id), "You're checked in")} loading={busy} />
                  </View>
                )}
              </View>
            )}

            {/* Collapsible full timeline */}
            <Pressable onPress={() => setShowSteps((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showSteps }} style={styles.stepsToggle}>
              <Text style={styles.stepsToggleText}>{showSteps ? 'Hide journey steps' : 'Show journey steps'}</Text>
              <Ionicons name={showSteps ? 'chevron-up' : 'chevron-down'} size={18} color={colors.forest700} />
            </Pressable>
            {showSteps && !cancelled && (
              <View style={styles.timeline}>
                {stages.map((s, i) => {
                  const done = i < reached;
                  const current = i === reached && !stalled && reached < stages.length;
                  return (
                    <View key={s.key} style={styles.stageRow}>
                      <View style={styles.rail}>
                        <View style={[styles.dot, done && styles.dotDone, current && styles.dotCurrent]}>
                          {done && <Ionicons name="checkmark" size={12} color={colors.white} />}
                        </View>
                        {i < stages.length - 1 && <View style={[styles.line, done && styles.lineDone]} />}
                      </View>
                      <View style={{ flex: 1, paddingBottom: i < stages.length - 1 ? space.md : 0 }}>
                        <Text style={[styles.stageLabel, (current || done) ? { color: colors.ink } : { color: colors.muted }]}>{s.label}</Text>
                        {(current || done) && <Text style={styles.stageHint}>{s.hint}</Text>}
                      </View>
                    </View>
                  );
                })}
                {t && (
                  <Text style={styles.estimate}>
                    Scheduled estimate — pickup {formatTime(b.pickupTimeSnapshot)}
                    {journey ? `, arrival ${formatTime(journey.arrivalTimeISO)}` : ''}
                    {t.delayMinutes > 0 ? ` · delayed +${t.delayMinutes} min` : ''}.
                  </Text>
                )}
              </View>
            )}

            {/* Live tracking (connected) */}
            {mode === 'connected' && t && (t.status === 'en_route' || t.status === 'boarding') && (
              <View style={styles.info}>
                <Text style={styles.infoTitle}><Ionicons name="navigate" size={13} color={colors.forest700} /> Live location</Text>
                {location.data ? (
                  <Text style={[styles.infoText, stale && { color: colors.amber800 }]}>
                    Last update {timeAgo(location.data.receivedAt)}{stale ? '  ·  stale, may be out of date' : ''}
                  </Text>
                ) : (
                  <Text style={styles.infoText}>No live location yet. Sharing works only while a staff device keeps the app open — this is a scheduled estimate, not GPS navigation.</Text>
                )}
              </View>
            )}

            {/* Demo simulation controls — separated from the real journey */}
            {mode === 'demo' && t && t.status !== 'completed' && t.status !== 'cancelled' && !cancelled && (
              <View style={styles.sim}>
                <Text style={styles.simTitle}>Demo controls</Text>
                <Text style={styles.simNote}>Fake operator actions so you can watch the journey advance. Not part of the passenger flow.</Text>
                <View style={styles.simBtns}>
                  <SimBtn label="Start" onPress={() => act(() => adapter.updateTripStatus(t.id, 'en_route'), 'Trip started.')} />
                  <SimBtn label="Add delay" onPress={() => act(() => adapter.reportDelay(t.id, 15), 'Delay +15 min.')} />
                  <SimBtn label="Complete" onPress={() => act(() => adapter.updateTripStatus(t.id, 'completed'), 'Trip completed.')} />
                </View>
              </View>
            )}

            {(b.status === 'reserved' || b.status === 'checked_in') && (
              <Pressable onPress={confirmCancel} accessibilityRole="button" accessibilityLabel="Cancel reservation" style={styles.cancel}>
                <Text style={styles.cancelText}>Cancel reservation</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SimBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.simBtn, pressed && { opacity: 0.85 }]}>
      <Text style={styles.simBtnText}>{label}</Text>
    </Pressable>
  );
}

function Banner({ tone, text }: { tone: 'red' | 'amber' | 'sand' | 'lime' | 'blue'; text: string }) {
  const map = {
    red: { bg: colors.red100, fg: colors.red700 },
    amber: { bg: colors.amber100, fg: colors.amber800 },
    sand: { bg: colors.surfaceAlt, fg: colors.inkSoft },
    lime: { bg: colors.lime100, fg: colors.forest800 },
    blue: { bg: colors.blue100, fg: colors.blue800 },
  }[tone];
  return (
    <View style={{ backgroundColor: map.bg, borderRadius: radius.md, padding: space.md }}>
      <Text style={{ color: map.fg, fontSize: font.small, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingVertical: space.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: font.title, fontWeight: '800', color: colors.ink },
  scroll: { paddingHorizontal: SCREEN, paddingTop: space.xs, paddingBottom: space.xxl * 2 },

  ticket: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, padding: space.lg, gap: space.sm },
  ticketHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  ticketKicker: { color: colors.muted, fontSize: font.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ticketDest: { color: colors.ink, fontWeight: '900', fontSize: font.h1 },
  ticketWhen: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  pickupTime: { color: colors.ink, fontWeight: '900', fontSize: font.time, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  pickupCaption: { color: colors.muted, fontSize: font.small, marginTop: 1 },
  arriveTime: { color: colors.inkSoft, fontWeight: '800', fontSize: font.h2, fontVariant: ['tabular-nums'] },
  qrBlock: { alignSelf: 'center', backgroundColor: colors.white, padding: space.sm, borderRadius: radius.md, marginTop: space.xs },
  code: { textAlign: 'center', fontSize: font.h2, fontWeight: '900', color: colors.ink, fontVariant: ['tabular-nums'], letterSpacing: 1 },
  showCode: { textAlign: 'center', color: colors.muted, fontSize: font.small, marginBottom: space.xs },
  ticketFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', paddingTop: space.xs },
  footItem: { color: colors.inkSoft, fontSize: font.small, fontWeight: '600' },
  footDot: { color: colors.muted },

  stepNow: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, padding: space.lg },
  stepNowLabel: { color: colors.forest600, fontSize: font.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  stepNowTitle: { color: colors.ink, fontWeight: '800', fontSize: font.h2, marginTop: 2 },
  stepNowHint: { color: colors.inkSoft, fontSize: font.small, marginTop: 4 },

  stepsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: space.sm, minHeight: control.small },
  stepsToggleText: { color: colors.forest700, fontWeight: '700', fontSize: font.small },
  timeline: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, padding: space.lg },
  stageRow: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center', width: 22 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.forest600, borderColor: colors.forest600 },
  dotCurrent: { borderColor: colors.lime500, backgroundColor: colors.lime100 },
  line: { flex: 1, width: 2, backgroundColor: colors.separator, marginTop: 2 },
  lineDone: { backgroundColor: colors.forest600 },
  stageLabel: { fontWeight: '700', fontSize: font.body },
  stageHint: { color: colors.muted, fontSize: font.small, marginTop: 2 },
  estimate: { color: colors.inkSoft, fontSize: font.small, marginTop: space.sm },

  info: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md },
  infoTitle: { fontWeight: '800', color: colors.forest700, fontSize: font.small },
  infoText: { color: colors.inkSoft, fontSize: font.small, marginTop: 4 },

  sim: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  simTitle: { fontWeight: '800', color: colors.inkSoft, fontSize: font.small, textTransform: 'uppercase', letterSpacing: 0.5 },
  simNote: { color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 15 },
  simBtns: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
  simBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, height: control.small, justifyContent: 'center', backgroundColor: colors.surface },
  simBtnText: { color: colors.inkSoft, fontWeight: '700', fontSize: font.small },

  cancel: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16, minHeight: control.small, justifyContent: 'center' },
  cancelText: { color: colors.red700, fontWeight: '700', fontSize: font.small, textDecorationLine: 'underline' },
});
