import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, font } from '../theme';
import type { BookingStatusCode, TripStatusCode } from '@shared/data/adapter';

const NEUTRAL = { bg: colors.surfaceAlt, fg: colors.inkSoft };
const GREEN = { bg: colors.forest100, fg: colors.forest700 };
const BLUE = { bg: colors.blue100, fg: colors.blue800 };
const RED = { bg: colors.red100, fg: colors.red700 };
const AMBER = { bg: colors.amber100, fg: colors.amber800 };

const TRIP: Record<TripStatusCode, { bg: string; fg: string; label: string }> = {
  scheduled: { ...NEUTRAL, label: 'Scheduled' },
  boarding: { ...GREEN, label: 'Boarding' },
  en_route: { ...BLUE, label: 'En route' },
  completed: { ...NEUTRAL, label: 'Completed' },
  cancelled: { ...RED, label: 'Cancelled' },
};

const BOOKING: Record<BookingStatusCode, { bg: string; fg: string; label: string }> = {
  reserved: { ...NEUTRAL, label: 'Reserved' },
  checked_in: { ...GREEN, label: 'Checked in' },
  boarded: { ...BLUE, label: 'Boarded' },
  completed: { ...NEUTRAL, label: 'Completed' },
  cancelled: { ...RED, label: 'Cancelled' },
  missed_pickup: { ...AMBER, label: 'Missed pickup' },
  not_boarded: { ...NEUTRAL, label: 'Not boarded' },
  no_show: { ...NEUTRAL, label: 'Not boarded' },
};

function Pill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function TripStatusPill({ status, delayed }: { status: TripStatusCode; delayed?: boolean }) {
  const s = TRIP[status];
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <Pill {...s} />
      {delayed && status !== 'cancelled' && status !== 'completed' && <Pill {...AMBER} label="Delayed" />}
    </View>
  );
}

export function BookingStatusPill({ status }: { status: BookingStatusCode }) {
  return <Pill {...BOOKING[status]} />;
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  text: { fontSize: font.tiny, fontWeight: '600' },
});
