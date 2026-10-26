import { Stack } from 'expo-router';
import { SpaceGate } from '@/session/SpaceGate';
import { colors } from '@/theme';

/** Operations console — admin identities only. */
export default function AdminLayout() {
  return (
    <SpaceGate space="admin">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="trip/[tripId]" />
        <Stack.Screen name="new-departure" options={{ presentation: 'modal' }} />
      </Stack>
    </SpaceGate>
  );
}
