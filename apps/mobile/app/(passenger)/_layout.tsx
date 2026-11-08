import { Stack } from 'expo-router';
import { SpaceGate } from '@/session/SpaceGate';
import { PickupReminders } from '@/notifications/PickupReminders';
import { SavedPassesSync } from '@/components/SavedPassesSync';
import { PushRegistration } from '@/notifications/PushRegistration';
import { colors } from '@/theme';

/** Passenger space: tabs plus the booking, boarding-pass, hub and notification
 *  screens. Only the passenger identity can enter. */
export default function PassengerLayout() {
  return (
    <SpaceGate space="passenger">
      <PickupReminders />
      <SavedPassesSync />
      <PushRegistration />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="book/[tripId]" />
        <Stack.Screen name="trip/[bookingId]" />
        <Stack.Screen name="hub/[hubId]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="map" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack>
    </SpaceGate>
  );
}
