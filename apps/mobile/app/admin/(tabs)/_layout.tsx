import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

type Icon = keyof typeof Ionicons.glyphMap;
const icon = (on: Icon, off: Icon) => ({ color, focused, size }: { color: unknown; focused: boolean; size: number }) =>
  <Ionicons name={focused ? on : off} size={size} color={color as string} />;

export default function AdminTabs() {
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
      <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: icon('pulse', 'pulse-outline') }} />
      <Tabs.Screen name="departures" options={{ title: 'Departures', tabBarIcon: icon('bus', 'bus-outline') }} />
      <Tabs.Screen name="network" options={{ title: 'Network', tabBarIcon: icon('git-network', 'git-network-outline') }} />
      <Tabs.Screen name="team" options={{ title: 'Team', tabBarIcon: icon('people', 'people-outline') }} />
    </Tabs>
  );
}
