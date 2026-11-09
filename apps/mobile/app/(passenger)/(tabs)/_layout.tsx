import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme';

type Icon = keyof typeof Ionicons.glyphMap;
const icon = (on: Icon, off: Icon) => ({ color, focused, size }: { color: unknown; focused: boolean; size: number }) =>
  <Ionicons name={focused ? on : off} size={size} color={color as string} />;

export default function PassengerTabs() {
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.forest700,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.separator },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Go', tabBarIcon: icon('navigate', 'navigate-outline') }} />
      <Tabs.Screen name="trips" options={{ title: 'My trips', tabBarIcon: icon('ticket', 'ticket-outline') }} />
      <Tabs.Screen name="hubs" options={{ title: 'Hubs', tabBarIcon: icon('location', 'location-outline') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
