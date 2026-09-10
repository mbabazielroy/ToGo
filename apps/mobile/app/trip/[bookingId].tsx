import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card, H2, Muted, PrimaryButton, GhostButton, Loading, ErrorRow, Separator } from '../../src/components/ui';
import { TripStatusPill, BookingStatusPill } from '../../src/components/StatusPill';
import { QRCode } from '../../src/components/QRCode';
import { useAdapter, useAppMode, useDataEpoch } from '../../src/data/AdapterProvider';
import { useAsync, humanError } from '../../src/hooks/useAsync';
import { useToast } from '../../src/components/ToastProvider';
import { haptics } from '../../src/lib/feedback';
import { colors, radius, space, font } from '../../src/theme';
import type { BookingStatusCode, TripStatusCode } from '@shared/data/adapter';
import { formatDate, formatTime, formatUGX, timeAgo } from '@shared/lib/time';

const DIR: Record<string, string> = { KLA_MBR: 'Kampala → Mbarara', MBR_KLA: 'Mbarara → Kampala' };

interface Stage { key: string; label: string; desc: string }

/** Number of journey stages considered complete, and whether the journey stalled. */
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
  const epoch = useDataEpoch();
  const [busy, setBusy] = useState(false);

  const booking = useAsync(() => adapter.getBooking(String(bookingId)), [bookingId, epoch]);
  const b = booking.data;
  const trip = useAsync(() => (b ? adapter.getTrip(b.tripId) : Promise.resolve(null)), [b?.tripId, epoch]);
  const location = useAsync(() => (b ? adapter.latestLocation(b.tripId) : Promise.resolve(null)), [b?.tripId, epoch]);
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

  const pickupHub = useMemo(
    () => (t && b ? t.stops.find((s) => s.hubId === b.pickupHubId) : undefined),
    [t, b],
  );
  const hubName = pickupHub?.hubName ?? 'your hub';
  const destination = t ? (DIR[t.direction] ?? t.operatorName) : (b?.reference ?? '');

  const stages: Stage[] = [
    { key: 'reserved', label: 'Reserved', desc: 'Your seat is held' },
    { key: 'checkin', label: `Check in at ${hubName}`, desc: 'Tap “I’m at the hub” when you arrive' },
    { key: 'board', label: 'Board', desc: 'Show your code to the conductor' },
    { key: 'travel', label: 'On the road', desc: `Heading to ${t ? destination.split('→ ')[1] ?? 'your stop' : 'your stop'}` },
    { key: 'arrive', label: 'Arrived', desc: 'Trip complete' },
  ];

  const staleMs = location.data ? Date.now() - new Date(location.data.receivedAt).getTime() : 0;
  const stale = staleMs > 120000;

  const { reached, stalled } = b ? stageProgress(b.status, t?.status) : { reached: 0, stalled: false };
  const cancelled = b?.status === 'cancelled';

  return (
    <Screen>
      <Pressable onPress={() => router.replace('/trips')} accessibilityRole="button" accessibilityLabel="Back to My Trips" style={styles.back}>
        <Ionicons name="chevron-back" size={18} color={colors.forest600} /><Text style={styles.backText}>My Trips</Text>
      </Pressable>
      {booking.loading && <Loading />}
      {booking.error && <ErrorRow message={booking.error} onRetry={booking.reload} />}
      {b && (
        <>
          {cancelled && <Banner tone="red" text="This reservation was cancelled and the seats released." />}
          {b.status === 'missed_pickup' && <Banner tone="amber" text="You checked in but were not boarded before the trip completed. Operations is investigating and will follow up." />}
          {(b.status === 'not_boarded' || b.status === 'no_show') && <Banner tone="sand" text="This trip has completed and you were not boarded, so you were not recorded as having travelled." />}

          {/* Boarding pass — large destination + pickup time, high-contrast QR on light bg */}
          <View style={styles.pass}>
            <View style={styles.passHead}>
              <Text style={styles.passKicker}>Boarding pass</Text>
              <BookingStatusPill status={b.status} />
            </View>
            <Text style={styles.passDest}>{destination}</Text>
            <View style={styles.passTimeRow}>
              <View>
                <Text style={styles.passTime}>{formatTime(b.pickupTimeSnapshot)}</Text>
                <Text style={styles.passTimeLabel}>Pickup · {formatDate(b.pickupTimeSnapshot.slice(0, 10))}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.passHub} numberOfLines={2}>{hubName}</Text>
                {t && <Text style={styles.passOp}>{t.operatorName}</Text>}
              </View>
            </View>

            <View style={styles.passBody}>
              <View style={styles.qrWrap}>
                <QRCode value={`TOGO:${b.boardingCredential}`} size={120} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.kLabel}>Reference</Text>
                <Text style={styles.ref} numberOfLines={1} adjustsFontSizeToFit>{b.reference}</Text>
                <View style={styles.kGrid}>
                  <Text style={styles.kLabel}>Passengers · Payment</Text>
                  <Text style={styles.kVal} numberOfLines={1}>{b.seats} · pay at boarding</Text>
                </View>
                <Text style={styles.kLabel}>Total fare</Text>
                <Text style={styles.passAmt} numberOfLines={1} adjustsFontSizeToFit>{formatUGX(b.fareUgxSnapshot * b.seats)}</Text>
              </View>
            </View>
          </View>
          <Muted style={{ textAlign: 'center', fontSize: font.tiny }}>
            The QR carries an opaque credential — no personal data. Only your conductor can validate it.
          </Muted>

          {/* Primary action (only one) — check in when reserved */}
          {b.status === 'reserved' && (
            <PrimaryButton title="I’m at the hub — check in" accent onPress={() => act(() => adapter.checkIn(b.id), "You're checked in")} loading={busy} />
          )}

          {/* Journey stages */}
          {!cancelled && (
            <Card style={{ gap: 0 }}>
              <View style={styles.stagesHead}>
                <H2>Your journey</H2>
                {t && <TripStatusPill status={t.status} delayed={t.delayMinutes > 0} />}
              </View>
              {stages.map((s, i) => {
                const done = i < reached;
                const current = i === reached && !stalled && reached < stages.length;
                const blocked = stalled && i >= reached;
                return (
                  <View key={s.key} style={styles.stageRow}>
                    <View style={styles.stageRail}>
                      <View style={[
                        styles.stageDot,
                        done && styles.stageDotDone,
                        current && styles.stageDotCurrent,
                        blocked && styles.stageDotBlocked,
                      ]}>
                        {done && <Ionicons name="checkmark" size={12} color={colors.white} />}
                        {current && <View style={styles.stageDotPulse} />}
                      </View>
                      {i < stages.length - 1 && <View style={[styles.stageLine, done && styles.stageLineDone]} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: i < stages.length - 1 ? space.md : 0 }}>
                      <Text style={[styles.stageLabel, current && { color: colors.forest900 }, (blocked || (!done && !current)) && { color: colors.muted }]}>
                        {s.label}
                      </Text>
                      {(current || done) && <Text style={styles.stageDesc}>{s.desc}</Text>}
                    </View>
                  </View>
                );
              })}

              {t && (
                <>
                  <Separator />
                  <Text style={styles.estimate}>
                    Scheduled estimate — pickup {formatTime(b.pickupTimeSnapshot)}, arrival {formatTime(t.destinationArrival)}
                    {t.delayMinutes > 0 ? ` · delayed +${t.delayMinutes} min` : ''}.
                  </Text>
                  {mode === 'connected' && (t.status === 'en_route' || t.status === 'boarding') && (
                    <View style={styles.liveBox}>
                      <Text style={styles.liveTitle}><Ionicons name="navigate" size={13} color={colors.forest700} /> Live location</Text>
                      {location.data ? (
                        <Text style={[styles.liveText, stale && { color: colors.amber800 }]}>
                          Last update {timeAgo(location.data.receivedAt)}{stale ? '  ·  ⚠ stale, may be out of date' : ''}
                        </Text>
                      ) : (
                        <Text style={styles.liveText}>No live location yet. Sharing works only while a staff device keeps the app open — this is a scheduled estimate, not GPS navigation.</Text>
                      )}
                    </View>
                  )}
                </>
              )}
            </Card>
          )}

          {b.status === 'checked_in' && <Banner tone="lime" text="Checked in and waiting — have your code ready for the conductor." />}
          {b.status === 'boarded' && <Banner tone="blue" text="Boarded — safe travels!" />}

          {/* Demo simulation controls — visibly separated from the real journey */}
          {mode === 'demo' && t && t.status !== 'completed' && t.status !== 'cancelled' && !cancelled && (
            <View style={styles.simBox}>
              <View style={styles.simHead}>
                <Ionicons name="construct-outline" size={14} color={colors.inkSoft} />
                <Text style={styles.simTitle}>Demo simulation controls</Text>
              </View>
              <Text style={styles.simNote}>These buttons fake operator actions so you can see the journey advance. They are not part of the passenger flow.</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <GhostButton title="Start (en route)" onPress={() => act(() => adapter.updateTripStatus(t.id, 'en_route'), 'Trip started.')} />
                <GhostButton title="Add delay" onPress={() => act(() => adapter.reportDelay(t.id, 15), 'Delay +15 min.')} />
                <GhostButton title="Complete" onPress={() => act(() => adapter.updateTripStatus(t.id, 'completed'), 'Trip completed.')} />
              </View>
            </View>
          )}

          {/* Cancellation — accessible but not competing with the primary action */}
          {(b.status === 'reserved' || b.status === 'checked_in') && (
            <Pressable onPress={confirmCancel} accessibilityRole="button" accessibilityLabel="Cancel reservation" style={styles.cancelLink}>
              <Text style={styles.cancelText}>Cancel reservation</Text>
            </Pressable>
          )}

          <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: 4 }}>
            <Text style={styles.link}>View notifications →</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

function Banner({ tone, text }: { tone: 'red' | 'amber' | 'sand' | 'lime' | 'blue'; text: string }) {
  const map = {
    red: { bg: colors.red100, fg: colors.red700 },
    amber: { bg: colors.amber100, fg: colors.amber800 },
    sand: { bg: colors.sand50, fg: colors.forest700 },
    lime: { bg: colors.lime100, fg: colors.forest700 },
    blue: { bg: colors.blue100, fg: colors.blue800 },
  }[tone];
  return (
    <View style={{ backgroundColor: map.bg, borderRadius: radius.md, padding: space.md }}>
      <Text style={{ color: map.fg, fontSize: font.small, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: colors.forest600, fontWeight: '700', fontSize: font.small },

  pass: { backgroundColor: colors.forest700, borderRadius: radius.xl, overflow: 'hidden', padding: space.lg, gap: 6 },
  passHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  passKicker: { color: colors.lime200, fontSize: font.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  passDest: { color: colors.white, fontWeight: '900', fontSize: font.h1, marginTop: 2 },
  passTimeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 2 },
  passTime: { color: colors.lime300, fontWeight: '900', fontSize: 34, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  passTimeLabel: { color: colors.forest100, fontSize: font.tiny, textTransform: 'uppercase', letterSpacing: 0.5 },
  passHub: { color: colors.white, fontWeight: '700', fontSize: font.body, textAlign: 'right', maxWidth: 160 },
  passOp: { color: colors.forest100, fontSize: font.small, textAlign: 'right' },
  passBody: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: colors.white, padding: space.md, borderRadius: radius.lg, marginTop: 10 },
  qrWrap: { backgroundColor: colors.white, padding: 6, borderRadius: radius.md },
  kLabel: { fontSize: font.tiny, color: colors.muted, textTransform: 'uppercase', marginTop: 6, letterSpacing: 0.4 },
  kVal: { fontSize: font.body, color: colors.ink, fontWeight: '700' },
  kGrid: {},
  ref: { fontSize: font.h2, fontWeight: '900', color: colors.forest900, fontVariant: ['tabular-nums'] },
  passAmt: { fontSize: font.title, fontWeight: '900', color: colors.forest900 },

  stagesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  stageRow: { flexDirection: 'row', gap: 12 },
  stageRail: { alignItems: 'center', width: 24 },
  stageDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.separator, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  stageDotDone: { backgroundColor: colors.forest600, borderColor: colors.forest600 },
  stageDotCurrent: { borderColor: colors.lime500, backgroundColor: colors.lime100 },
  stageDotBlocked: { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  stageDotPulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.lime500 },
  stageLine: { flex: 1, width: 2, backgroundColor: colors.separator, marginTop: 2 },
  stageLineDone: { backgroundColor: colors.forest600 },
  stageLabel: { fontWeight: '800', color: colors.inkSoft, fontSize: font.body },
  stageDesc: { color: colors.muted, fontSize: font.small, marginTop: 2 },

  estimate: { color: colors.inkSoft, fontSize: font.small, marginTop: space.md },
  liveBox: { backgroundColor: colors.forest50, borderRadius: radius.md, padding: space.md, marginTop: space.sm },
  liveTitle: { fontWeight: '800', color: colors.forest700, fontSize: font.small },
  liveText: { color: colors.muted, fontSize: font.small, marginTop: 4 },

  simBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: colors.separator, borderStyle: 'dashed' },
  simHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  simTitle: { fontWeight: '800', color: colors.inkSoft, fontSize: font.small, textTransform: 'uppercase', letterSpacing: 0.5 },
  simNote: { color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 15 },

  cancelLink: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
  cancelText: { color: colors.red700, fontWeight: '700', fontSize: font.small, textDecorationLine: 'underline' },
  link: { color: colors.forest600, fontWeight: '700', fontSize: font.small },
});
