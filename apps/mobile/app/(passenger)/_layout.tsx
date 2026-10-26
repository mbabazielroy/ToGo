import { Stack } from 'expo-router';
import { SpaceGate } from '@/session/SpaceGate';
import { colors } from '@/theme';

/** Passenger space: tabs plus the booking, boarding-pass, hub and notification
 *  screens. Only the passenger identity can enter. */
export default function PassengerLayout() {
  return (
    <SpaceGate space="passenger">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="book/[tripId]" />
        <Stack.Screen name="trip/[bookingId]" />
        <Stack.Screen name="hub/[hubId]" />
        <Stack.Screen name="notifications" />
      </Stack>
    </SpaceGate>
  );
}
