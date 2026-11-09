import { View, Text } from 'react-native';
import { QRCode } from './QRCode';
import { Group, Separator } from './ui';
import { space, font, makeStyles } from '../theme';
import { formatDate, formatTime, formatUGX, timeAgo } from '@shared/lib/time';
import { DIRECTION_CITIES } from '@shared/lib/lookup';
import type { SavedPass } from '../lib/savedPasses';

/**
 * A boarding pass drawn only from the copy saved on the phone, for when the app
 * can't reach the server at all (opened at a hub with no signal).
 */
export function SavedPassCard({ pass }: { pass: SavedPass }) {
  const styles = useStyles();
  const { booking: b, trip: t } = pass;
  const destination = t ? DIRECTION_CITIES[t.direction]?.destination : undefined;
  const hubName = t?.stops.find((s) => s.hubId === b.pickupHubId)?.hubName;
  return (
    <Group style={{ padding: space.lg }}>
      {t && <Text style={styles.op} numberOfLines={1}>{t.operatorName}{t.vehicleLabel ? ` · ${t.vehicleLabel}` : ''}</Text>}
      <Text style={styles.kicker}>{destination ? 'To' : 'Booking'}</Text>
      <Text style={styles.dest} numberOfLines={1}>{destination ?? b.reference}</Text>
      <Text style={styles.time}>{formatTime(b.pickupTimeSnapshot)}</Text>
      <Text style={styles.caption} numberOfLines={1}>
        Pickup · {formatDate(b.pickupTimeSnapshot.slice(0, 10))}{hubName ? ` · ${hubName}` : ''}
      </Text>
      <View style={styles.qr}>
        <QRCode value={`TOGO:${b.boardingCredential}`} size={150} />
      </View>
      <Text style={styles.code}>{b.reference}</Text>
      {b.boardingCredential.length <= 8 && (
        <Text style={styles.show}>Boarding code <Text style={styles.pin}>{b.boardingCredential}</Text></Text>
      )}
      <Separator />
      <Text style={styles.foot}>
        {b.seats} passenger{b.seats === 1 ? '' : 's'} · {formatUGX(b.fareUgxSnapshot * b.seats)} · Pay at boarding
      </Text>
      <Text style={styles.saved}>Saved on this phone, updated {timeAgo(pass.savedAt)}</Text>
    </Group>
  );
}

const useStyles = makeStyles((colors) => ({
  op: { color: colors.muted, fontSize: font.tiny, fontWeight: '600', marginBottom: 6 },
  kicker: { color: colors.muted, fontSize: font.tiny, textTransform: 'uppercase', letterSpacing: 0.4 },
  dest: { color: colors.ink, fontWeight: '700', fontSize: font.h1 },
  time: { color: colors.ink, fontWeight: '700', fontSize: font.time, fontVariant: ['tabular-nums'], letterSpacing: -0.5, marginTop: space.sm },
  caption: { color: colors.muted, fontSize: font.small, marginTop: 2 },
  qr: { alignSelf: 'center', marginTop: space.lg, marginBottom: space.sm },
  code: { textAlign: 'center', fontSize: font.h2, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'], letterSpacing: 2 },
  show: { textAlign: 'center', color: colors.muted, fontSize: font.small, marginTop: 4, marginBottom: space.md },
  pin: { fontWeight: '800', color: colors.ink, letterSpacing: 2, fontVariant: ['tabular-nums'] },
  foot: { textAlign: 'center', color: colors.inkSoft, fontSize: font.small, paddingTop: space.md },
  saved: { textAlign: 'center', color: colors.muted, fontSize: font.tiny, marginTop: 4 },
}));
