import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SpaceGate } from '@/session/SpaceGate';
import { useSession } from '@/session/SessionProvider';
import { colors } from '@/theme';

type Icon = keyof typeof Ionicons.glyphMap;
const icon = (on: Icon, off: Icon) => ({ color, focused, size }: { color: unknown; focused: boolean; size: number }) =>
  <Ionicons name={focused ? on : off} size={size} color={color as string} />;

/** Crew workspace — drivers, conductors and hub attendants only. */
export default function CrewLayout() {
  return (
    <SpaceGate space="crew">
      <CrewTabs />
    </SpaceGate>
  );
}

function CrewTabs() {
  const { identity } = useSession();
  const role = identity?.role;
  const todayTitle = role === 'conductor' ? 'Boarding' : role === 'attendant' ? 'Hub' : 'Drive';
  const todayIcon = role === 'conductor' ? icon('scan', 'scan-outline') : role === 'attendant' ? icon('location', 'location-outline') : icon('bus', 'bus-outline');
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
      <Tabs.Screen name="index" options={{ title: todayTitle, tabBarIcon: todayIcon }} />
      <Tabs.Screen name="shift" options={{ title: 'Shift', tabBarIcon: icon('calendar', 'calendar-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
