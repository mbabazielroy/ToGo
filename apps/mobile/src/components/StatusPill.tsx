import { View, Text, StyleSheet } from 'react-native';
import { radius, font, useColors, type Colors } from '../theme';
import type { BookingStatusCode, TripStatusCode } from '@shared/data/adapter';

type Tone = 'neutral' | 'green' | 'blue' | 'red' | 'amber';
const NEUTRAL = { tone: 'neutral' as Tone };
const GREEN = { tone: 'green' as Tone };
const BLUE = { tone: 'blue' as Tone };
const RED = { tone: 'red' as Tone };
const AMBER = { tone: 'amber' as Tone };

function toneColors(c: Colors, tone: Tone): { bg: string; fg: string } {
  switch (tone) {
    case 'green': return { bg: c.forest100, fg: c.forest800 };
    case 'blue': return { bg: c.blue100, fg: c.blue800 };
    case 'red': return { bg: c.red100, fg: c.red700 };
    case 'amber': return { bg: c.amber100, fg: c.amber800 };
    default: return { bg: c.surfaceAlt, fg: c.inkSoft };
  }
}

const TRIP: Record<TripStatusCode, { tone: Tone; label: string }> = {
  scheduled: { ...NEUTRAL, label: 'Scheduled' },
  boarding: { ...GREEN, label: 'Boarding' },
  en_route: { ...BLUE, label: 'En route' },
  completed: { ...NEUTRAL, label: 'Completed' },
  cancelled: { ...RED, label: 'Cancelled' },
};

const BOOKING: Record<BookingStatusCode, { tone: Tone; label: string }> = {
  reserved: { ...NEUTRAL, label: 'Reserved' },
  checked_in: { ...GREEN, label: 'Checked in' },
  boarded: { ...BLUE, label: 'Boarded' },
  completed: { ...NEUTRAL, label: 'Completed' },
  cancelled: { ...RED, label: 'Cancelled' },
  missed_pickup: { ...AMBER, label: 'Missed pickup' },
  not_boarded: { ...NEUTRAL, label: 'Not boarded' },
  no_show: { ...NEUTRAL, label: 'Not boarded' },
};

function Pill({ tone, label }: { tone: Tone; label: string }) {
  const { bg, fg } = toneColors(useColors(), tone);
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
