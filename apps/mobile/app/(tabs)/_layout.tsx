import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.forest700,
        tabBarInactiveTintColor: colors.forest500,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.forest100 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="hubs"
        options={{ title: 'Hubs', tabBarIcon: ({ color, size }) => <Ionicons name="location" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="trips"
        options={{ title: 'My Trips', tabBarIcon: ({ color, size }) => <Ionicons name="ticket" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
