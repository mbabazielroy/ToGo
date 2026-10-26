import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavBar, Group, PrimaryButton, GhostButton, Loading, ErrorRow, Separator } from '@/components/ui';
import { BookingStatusPill } from '@/components/StatusPill';
import { QRCode } from '@/components/QRCode';
import { useAdapter, useAppMode } from '@/data/AdapterProvider';
import { useAsync, humanError } from '@/hooks/useAsync';
import { useToast } from '@/components/ToastProvider';
import { haptics } from '@/lib/feedback';
import { colors, radius, space, font, SCREEN, control } from '@/theme';
import type { BookingStatusCode, TripStatusCode } from '@shared/data/adapter';
import { formatTime, formatUGX, timeAgo } from '@shared/lib/time';
import { tripJourney } from '@shared/data/journey';
import { useNow, leadTime } from '@/hooks/useNow';
import { lineFor } from '@/lib/lines';
import { LineBadge } from '@/components/ui';
import { ask } from '@/lib/dialog';

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
  const now = useNow(30000);

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
    ask('Cancel reservation', 'Your seats will be released.', [
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
      <NavBar title="Boarding pass" onBack={() => router.replace('/trips')} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: space.xxl * 2 }}>
        {booking.loading && <Loading />}
        {booking.error && <ErrorRow message={booking.error} onRetry={booking.reload} />}
        {b && (
          <View style={{ gap: space.md }}>
            {cancelled && <Banner tone="red" text="This reservation was cancelled and the seats released." />}
            {!cancelled && t && t.delayMinutes > 0 && t.status !== 'completed' &&
              (b.status === 'reserved' || b.status === 'checked_in' || b.status === 'boarded') && (
                <Banner tone="amber" text={`Service alert: this bus is running about ${t.delayMinutes} min late. Please allow for the delay at ${hubName}.`} />
            )}
            {b.status === 'missed_pickup' && <Banner tone="amber" text="You checked in but were not boarded before the trip completed. Operations is investigating and will follow up." />}
            {(b.status === 'not_boarded' || b.status === 'no_show') && <Banner tone="grey" text="This trip has completed and you were not boarded, so you were not recorded as having travelled." />}

            {/* Ticket */}
            <Group style={{ padding: space.lg }}>
              <View style={styles.ticketHead}>
                <View style={{ flex: 1 }}>
                  {t && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <LineBadge code={lineFor(t.operatorId, t.operatorName).code} color={lineFor(t.operatorId, t.operatorName).color} size="sm" />
                      <Text style={styles.ticketOp} numberOfLines={1}>{t.operatorName}{t.vehicleLabel ? ` · ${t.vehicleLabel}` : ''}</Text>
                    </View>
                  )}
                  <Text style={styles.ticketKicker}>To</Text>
                  <Text style={styles.ticketDest} numberOfLines={1}>{destination}</Text>
                </View>
                <BookingStatusPill status={b.status} />
              </View>
              <View style={styles.ticketWhen}>
                <View>
                  <Text style={styles.pickupTime}>{formatTime(b.pickupTimeSnapshot)}</Text>
                  <Text style={styles.pickupCaption} numberOfLines={1}>Pickup · {hubName}</Text>
                  {(b.status === 'reserved' || b.status === 'checked_in') && (
                    <Text style={styles.lead}>{leadTime(b.pickupTimeSnapshot, now)}</Text>
                  )}
                </View>
                {journey && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.arriveTime}>{formatTime(journey.arrivalTimeISO)}</Text>
                    <Text style={styles.pickupCaption}>Est. arrival</Text>
                  </View>
                )}
              </View>

              <View style={styles.qrBlock}>
                <QRCode value={`TOGO:${b.boardingCredential}`} size={150} />
              </View>
              <Text style={styles.code}>{b.reference}</Text>
              {b.boardingCredential.length <= 8 ? (
                <Text style={styles.showCode}>Show this QR to the conductor · no signal? Boarding code <Text style={styles.pin}>{b.boardingCredential}</Text></Text>
              ) : (
                <Text style={styles.showCode}>Show this QR to the conductor.</Text>
              )}

              <Separator />
              <View style={styles.ticketFoot}>
                <Text style={styles.footItem}>{b.seats} passenger{b.seats === 1 ? '' : 's'}</Text>
                <Text style={styles.footDot}>·</Text>
                <Text style={styles.footItem}>{formatUGX(b.fareUgxSnapshot * b.seats)}</Text>
                <Text style={styles.footDot}>·</Text>
                <Text style={styles.footItem}>Pay at boarding</Text>
              </View>
            </Group>

            {/* Current step */}
            {currentStage && (
              <Group style={{ padding: space.lg }}>
                <Text style={styles.stepKicker}>Next · step {reached + 1} of {stages.length}</Text>
                <Text style={styles.stepTitle}>{currentStage.label}</Text>
                <Text style={styles.stepHint}>{currentStage.hint}</Text>
                {b.status === 'reserved' && (
                  <View style={{ marginTop: space.md }}>
                    <PrimaryButton title="Check in" onPress={() => act(() => adapter.checkIn(b.id), "You're checked in")} loading={busy} />
                  </View>
                )}
              </Group>
            )}

            {/* Collapsible timeline */}
            <Pressable onPress={() => setShowSteps((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showSteps }} style={styles.stepsToggle}>
              <Text style={styles.stepsToggleText}>{showSteps ? 'Hide journey steps' : 'Show journey steps'}</Text>
              <Ionicons name={showSteps ? 'chevron-up' : 'chevron-down'} size={16} color={colors.forest700} />
            </Pressable>
            {showSteps && !cancelled && (
              <Group style={{ padding: space.lg }}>
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
              </Group>
            )}

            {/* Live tracking (connected) */}
            {mode === 'connected' && t && (t.status === 'en_route' || t.status === 'boarding') && (
              <Group style={{ padding: space.lg }}>
                <Text style={styles.infoTitle}>Live location</Text>
                {location.data ? (
                  <Text style={[styles.infoText, stale && { color: colors.amber800 }]}>
                    Last update {timeAgo(location.data.receivedAt)}{stale ? '  ·  stale, may be out of date' : ''}
                  </Text>
                ) : (
                  <Text style={styles.infoText}>No live location yet. Sharing works only while a staff device keeps the app open — this is a scheduled estimate, not GPS navigation.</Text>
                )}
              </Group>
            )}

            {mode === 'demo' && t && t.status !== 'completed' && t.status !== 'cancelled' && !cancelled && (
              <Text style={styles.previewHint}>Preview tip: the bus moves when crew act on it. Sign out and open the staff workspace as this trip's driver or conductor to start it, report a delay or board you.</Text>
            )}

            {(b.status === 'reserved' || b.status === 'checked_in') && (
              <GhostButton title="Cancel reservation" danger onPress={confirmCancel} style={{ marginTop: space.xs }} />
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Banner({ tone, text }: { tone: 'red' | 'amber' | 'grey'; text: string }) {
  const map = {
    red: { bg: colors.red100, fg: colors.red700 },
    amber: { bg: colors.amber100, fg: colors.amber800 },
    grey: { bg: colors.surfaceAlt, fg: colors.inkSoft },
  }[tone];
  return (
    <View style={{ backgroundColor: map.bg, borderRadius: radius.md, padding: space.md }}>
      <Text style={{ color: map.fg, fontSize: font.small, fontWeight: '500' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  ticketHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  ticketOp: { flex: 1, color: colors.muted, fontSize: font.tiny, fontWeight: '600' },
  lead: { color: colors.forest600, fontSize: font.small, fontWeight: '700', marginTop: 2 },
  ticketKicker: { color: colors.muted, fontSize: font.tiny, fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.4 },
  ticketDest: { color: colors.ink, fontWeight: '700', fontSize: font.h1 },
  ticketWhen: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space.sm },
  pickupTime: { color: colors.ink, fontWeight: '700', fontSize: font.time, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  pickupCaption: { color: colors.muted, fontSize: font.small, marginTop: 2 },
  arriveTime: { color: colors.inkSoft, fontWeight: '600', fontSize: font.h2, fontVariant: ['tabular-nums'] },
  qrBlock: { alignSelf: 'center', backgroundColor: colors.white, padding: space.md, borderRadius: radius.md, marginTop: space.lg, marginBottom: space.sm },
  code: { textAlign: 'center', fontSize: font.h2, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'], letterSpacing: 2 },
  pin: { fontWeight: '800', color: colors.ink, letterSpacing: 2, fontVariant: ['tabular-nums'] },
  showCode: { textAlign: 'center', color: colors.muted, fontSize: font.small, marginTop: 4, marginBottom: space.md },
  ticketFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', paddingTop: space.md },
  footItem: { color: colors.inkSoft, fontSize: font.small },
  footDot: { color: colors.faint },

  stepKicker: { color: colors.forest700, fontSize: font.tiny, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  stepTitle: { color: colors.ink, fontWeight: '700', fontSize: font.h2, marginTop: 3 },
  stepHint: { color: colors.inkSoft, fontSize: font.small, marginTop: 4 },

  stepsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: space.sm, minHeight: control.small },
  stepsToggleText: { color: colors.forest700, fontWeight: '500', fontSize: font.body },
  stageRow: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center', width: 22 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.forest700, borderColor: colors.forest700 },
  dotCurrent: { borderColor: colors.forest700, backgroundColor: colors.surface },
  line: { flex: 1, width: 2, backgroundColor: colors.separator, marginTop: 2 },
  lineDone: { backgroundColor: colors.forest700 },
  stageLabel: { fontWeight: '500', fontSize: font.body },
  stageHint: { color: colors.muted, fontSize: font.small, marginTop: 2 },
  estimate: { color: colors.muted, fontSize: font.small, marginTop: space.sm },

  infoTitle: { fontWeight: '600', color: colors.ink, fontSize: font.body },
  infoText: { color: colors.inkSoft, fontSize: font.small, marginTop: 4 },

  previewHint: { color: colors.muted, fontSize: font.tiny, lineHeight: 17, textAlign: 'center', paddingHorizontal: space.md },
});
