import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, font } from '../theme';
import type { BookingStatusCode, TripStatusCode } from '@shared/data/adapter';

const TRIP: Record<TripStatusCode, { bg: string; fg: string; label: string }> = {
  scheduled: { bg: colors.forest100, fg: colors.forest700, label: 'Scheduled' },
  boarding: { bg: colors.lime200, fg: colors.forest900, label: 'Boarding' },
  en_route: { bg: colors.blue100, fg: colors.blue800, label: 'En route' },
  completed: { bg: colors.forest200, fg: colors.forest800, label: 'Completed' },
  cancelled: { bg: colors.red100, fg: colors.red700, label: 'Cancelled' },
};

const BOOKING: Record<BookingStatusCode, { bg: string; fg: string; label: string }> = {
  reserved: { bg: colors.forest100, fg: colors.forest700, label: 'Reserved' },
  checked_in: { bg: colors.lime200, fg: colors.forest900, label: 'Checked in' },
  boarded: { bg: colors.blue100, fg: colors.blue800, label: 'Boarded' },
  completed: { bg: colors.forest200, fg: colors.forest800, label: 'Completed' },
  cancelled: { bg: colors.red100, fg: colors.red700, label: 'Cancelled' },
  missed_pickup: { bg: colors.amber100, fg: colors.amber800, label: 'Missed pickup' },
  not_boarded: { bg: colors.sand200, fg: colors.forest700, label: 'Not boarded' },
  no_show: { bg: colors.amber100, fg: colors.amber800, label: 'Not boarded' },
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
      {delayed && status !== 'cancelled' && status !== 'completed' && (
        <Pill bg={colors.amber100} fg={colors.amber800} label="Delayed" />
      )}
    </View>
  );
}

export function BookingStatusPill({ status }: { status: BookingStatusCode }) {
  return <Pill {...BOOKING[status]} />;
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  text: { fontSize: font.tiny, fontWeight: '700' },
});
