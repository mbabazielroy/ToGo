import { View, Text, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { distanceKm, formatDistance, type LatLng } from '@shared/data/geo';
import { haptics } from '@/lib/feedback';
import { font, radius, space, useColors, makeStyles } from '@/theme';
import type { MyLocation } from './useMyLocation';

/** Closer than this, "you're here" rather than a distance (GPS is ±20–50 m). */
const AT_HUB_KM = 0.06;

/**
 * "You're 850 m from Ndeeba hub", kept up to date as the passenger walks, or a
 * button to turn location on. Works without a connection: GPS needs no data.
 */
export function DistanceToHub({ location, hub, hubName }: { location: MyLocation; hub: LatLng | null; hubName: string }) {
  const colors = useColors();
  const styles = useStyles();
  if (!hub) return null;
  const { coord, status } = location;

  if (coord) {
    const d = distanceKm(coord, hub);
    const here = d < AT_HUB_KM;
    return (
      <View style={styles.row} accessibilityRole="text" accessibilityLiveRegion="polite"
        accessibilityLabel={here ? `You're at ${hubName}` : `You're ${formatDistance(d)} from ${hubName}`}>
        <View style={styles.icon}><Ionicons name={here ? 'checkmark' : 'walk'} size={16} color={colors.white} /></View>
        <Text style={styles.text}>
          {here ? <>You’re at <Text style={styles.strong}>{hubName}</Text></> : <>You’re <Text style={styles.strong}>{formatDistance(d)}</Text> from {hubName}</>}
        </Text>
      </View>
    );
  }

  if (status === 'denied') {
    return (
      <Pressable onPress={() => Linking.openSettings().catch(() => {})} accessibilityRole="button"
        accessibilityLabel="Location is off. Open Settings to allow it." style={styles.row}>
        <Ionicons name="location-outline" size={18} color={colors.muted} />
        <Text style={[styles.text, { color: colors.muted }]}>Location is off. Allow it in Settings to see how far you are from {hubName}.</Text>
      </Pressable>
    );
  }

  if (status === 'on' || status === 'asking') {
    return (
      <View style={styles.row} accessibilityRole="text">
        <Ionicons name="locate-outline" size={18} color={colors.muted} />
        <Text style={[styles.text, { color: colors.muted }]}>Finding where you are…</Text>
      </View>
    );
  }

  return (
    <Pressable onPress={() => { haptics.select(); location.enable(); }} accessibilityRole="button"
      accessibilityLabel={`Show how far I am from ${hubName}`} style={({ pressed }) => [styles.row, styles.button, pressed && { opacity: 0.8 }]}>
      <Ionicons name="locate" size={18} color={colors.forest700} />
      <Text style={[styles.text, styles.buttonText]}>Show how far I am from the hub</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.md,
    borderRadius: radius.lg, backgroundColor: colors.surface, minHeight: 44 },
  icon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#1f5fd1', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, fontSize: font.small, color: colors.ink },
  strong: { fontWeight: '700' },
  button: { borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.forest700, fontWeight: '600' },
}));
