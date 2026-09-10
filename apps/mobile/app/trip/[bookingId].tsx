import { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card, H2, Muted, PrimaryButton, GhostButton, Loading, ErrorRow } from '../../src/components/ui';
import { TripStatusPill, BookingStatusPill } from '../../src/components/StatusPill';
import { QRCode } from '../../src/components/QRCode';
import { useAdapter, useAppMode, useDataEpoch } from '../../src/data/AdapterProvider';
import { useAsync, humanError } from '../../src/hooks/useAsync';
import { useToast } from '../../src/components/ToastProvider';
import { colors, radius, space, font } from '../../src/theme';
import { formatDate, formatTime, formatUGX, timeAgo } from '@shared/lib/time';

const DIR: Record<string, string> = { KLA_MBR: 'Kampala → Mbarara', MBR_KLA: 'Mbarara → Kampala' };

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
    try { await fn(); toast(ok, 'ok'); booking.reload(); trip.reload(); }
    catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }
  function confirmCancel() {
    Alert.alert('Cancel reservation', 'Your seats will be released.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel reservation', style: 'destructive', onPress: () => act(() => adapter.cancelBooking(b!.id), 'Reservation cancelled') },
    ]);
  }

  const staleMs = location.data ? Date.now() - new Date(location.data.receivedAt).getTime() : 0;
  const stale = staleMs > 120000;

  return (
    <Screen>
      <Pressable onPress={() => router.replace('/trips')} style={styles.back}>
        <Ionicons name="chevron-back" size={18} color={colors.forest600} /><Text style={styles.backText}>My Trips</Text>
      </Pressable>
      {booking.loading && <Loading />}
      {booking.error && <ErrorRow message={booking.error} onRetry={booking.reload} />}
      {b && (
        <>
          {b.status === 'cancelled' && <Banner tone="red" text="This reservation was cancelled and the seats released." />}
          {b.status === 'missed_pickup' && <Banner tone="amber" text="You checked in but were not boarded before the trip completed. Operations is investigating and will follow up." />}
          {(b.status === 'not_boarded' || b.status === 'no_show') && <Banner tone="sand" text="This trip has completed and you were not boarded, so you were not recorded as having travelled." />}

          {/* Boarding pass */}
          <View style={styles.pass}>
            <View style={styles.passHead}>
              <View>
                <Text style={styles.passKicker}>Boarding pass</Text>
                <Text style={styles.passTitle}>{t ? (DIR[t.direction] ?? t.operatorName) : b.reference}</Text>
              </View>
              {t && <TripStatusPill status={t.status} delayed={t.delayMinutes > 0} />}
            </View>
            <View style={styles.passBody}>
              <QRCode value={`TOGO:${b.boardingCredential}`} size={120} />
              <View style={{ flex: 1 }}>
                <Text style={styles.kLabel}>Reference</Text>
                <Text style={styles.ref}>{b.reference}</Text>
                <Text style={styles.kLabel}>Passengers</Text>
                <Text style={styles.kVal}>{b.seats}</Text>
                <Text style={styles.kLabel}>Pickup</Text>
                <Text style={styles.kVal}>{formatDate(b.pickupTimeSnapshot.slice(0, 10))} · {formatTime(b.pickupTimeSnapshot)}</Text>
              </View>
            </View>
            <View style={styles.passFoot}>
              <Text style={styles.payText}>Pay at boarding</Text>
              <Text style={styles.payAmt}>{formatUGX(b.fareUgxSnapshot * b.seats)}</Text>
            </View>
          </View>
          <Muted style={{ textAlign: 'center', fontSize: font.tiny }}>
            The QR carries an opaque credential — no personal data. Only your conductor can validate it.
          </Muted>

          {/* Status / tracking */}
          {t && (
            <Card style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <H2>Trip status</H2>
                <BookingStatusPill status={b.status} />
              </View>
              <Muted style={{ fontSize: font.small }}>
                Scheduled estimate — pickup {formatTime(b.pickupTimeSnapshot)}, arrival {formatTime(t.destinationArrival)}
                {t.delayMinutes > 0 ? ` · delayed +${t.delayMinutes} min` : ''}.
              </Muted>

              {mode === 'connected' ? (
                (t.status === 'en_route' || t.status === 'boarding') && (
                  <View style={styles.liveBox}>
                    <Text style={styles.liveTitle}><Ionicons name="navigate" size={13} color={colors.forest700} /> Live location</Text>
                    {location.data ? (
                      <Text style={styles.liveText}>
                        Last update {timeAgo(location.data.receivedAt)}{stale ? '  ·  ⚠ stale' : ''}
                      </Text>
                    ) : (
                      <Text style={styles.liveText}>No live location yet. Sharing works only while a staff device keeps the app open — this is a scheduled estimate, not GPS navigation.</Text>
                    )}
                  </View>
                )
              ) : (
                <View style={styles.liveBox}>
                  <Text style={styles.liveTitle}>Simulated tracking (demo)</Text>
                  <Text style={styles.liveText}>Progress {Math.round((t.progress ?? 0) * 100)}% · status {t.status}. Use the demo controls below.</Text>
                  {t.status !== 'completed' && t.status !== 'cancelled' && (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <GhostButton title="Start (en route)" onPress={() => act(() => adapter.updateTripStatus(t.id, 'en_route'), 'Trip started.')} />
                      <GhostButton title="Add delay" onPress={() => act(() => adapter.reportDelay(t.id, 15), 'Delay +15 min.')} />
                      <GhostButton title="Complete" onPress={() => act(() => adapter.updateTripStatus(t.id, 'completed'), 'Trip completed.')} />
                    </View>
                  )}
                </View>
              )}
            </Card>
          )}

          {/* Actions */}
          {b.status === 'reserved' && (
            <Card style={{ gap: 8 }}>
              <Muted>When you reach your hub, tap below so staff know you're waiting. Check-in is simulated — no GPS is requested.</Muted>
              <PrimaryButton title="I'm at the hub (check in)" accent onPress={() => act(() => adapter.checkIn(b.id), "You're checked in")} loading={busy} />
            </Card>
          )}
          {b.status === 'checked_in' && <Banner tone="lime" text="Checked in and waiting — have your code ready for the conductor." />}
          {b.status === 'boarded' && <Banner tone="blue" text="Boarded — safe travels!" />}

          {(b.status === 'reserved' || b.status === 'checked_in') && (
            <GhostButton title="Cancel reservation" onPress={confirmCancel} danger />
          )}

          <Pressable onPress={() => router.push('/notifications')} style={{ alignSelf: 'center', marginTop: 4 }}>
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
  pass: { backgroundColor: colors.forest700, borderRadius: radius.xl, overflow: 'hidden' },
  passHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.md },
  passKicker: { color: colors.lime200, fontSize: font.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  passTitle: { color: colors.white, fontWeight: '900', fontSize: font.title },
  passBody: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: colors.white, padding: space.md },
  kLabel: { fontSize: font.tiny, color: colors.forest500, textTransform: 'uppercase', marginTop: 4 },
  kVal: { fontSize: font.body, color: colors.forest900, fontWeight: '600' },
  ref: { fontSize: font.h2, fontWeight: '900', color: colors.forest900, fontVariant: ['tabular-nums'] },
  passFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.md },
  payText: { color: colors.forest100, fontSize: font.small, fontWeight: '600' },
  payAmt: { color: colors.white, fontWeight: '800' },
  liveBox: { backgroundColor: colors.forest50, borderRadius: radius.md, padding: space.md },
  liveTitle: { fontWeight: '800', color: colors.forest700, fontSize: font.small },
  liveText: { color: colors.muted, fontSize: font.small, marginTop: 4 },
  link: { color: colors.forest600, fontWeight: '700', fontSize: font.small },
});
