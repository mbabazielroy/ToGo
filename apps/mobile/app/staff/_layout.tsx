import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

/** Staff workspace has its own stack navigation, separate from passenger tabs,
 *  reusing the same visual system. */
export default function StaffLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="driver" />
      <Stack.Screen name="conductor" />
      <Stack.Screen name="attendant" />
    </Stack>
  );
}
