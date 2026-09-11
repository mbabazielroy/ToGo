import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdapterProvider } from '../src/data/AdapterProvider';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { SearchProvider } from '../src/state/search';
import { ToastProvider } from '../src/components/ToastProvider';
import { useAuthDeepLinks } from '../src/auth/useAuthDeepLinks';
import { APP_MODE } from '../src/env';
import { colors } from '../src/theme';

// Connected-mode auth routing. Public browsing is allowed (hubs/departures are
// public); authentication is required only for protected actions (reserving, My
// Trips, notifications, account), which each prompt to sign in in context. The only
// global redirect here is password-recovery, which must land on the reset screen.
function AuthGate() {
  const { loading, recoveryMode } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useAuthDeepLinks();

  useEffect(() => {
    if (APP_MODE !== 'connected' || loading) return;
    const top = segments[0] as string | undefined;
    if (recoveryMode && top !== 'reset') router.replace('/reset');
  }, [loading, recoveryMode, segments, router]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AdapterProvider>
        <AuthProvider>
          <SearchProvider>
            <ToastProvider>
              <AuthGate />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="book/[tripId]" options={{ presentation: 'card' }} />
                <Stack.Screen name="hub/[hubId]" />
                <Stack.Screen name="trip/[bookingId]" />
                <Stack.Screen name="notifications" />
                <Stack.Screen name="auth" />
                <Stack.Screen name="reset" />
              </Stack>
            </ToastProvider>
          </SearchProvider>
        </AuthProvider>
      </AdapterProvider>
    </SafeAreaProvider>
  );
}
