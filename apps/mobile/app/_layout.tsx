import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdapterProvider } from '@/data/AdapterProvider';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { SessionProvider } from '@/session/SessionProvider';
import { SearchProvider } from '@/state/search';
import { ToastProvider } from '@/components/ToastProvider';
import { useAuthDeepLinks } from '@/auth/useAuthDeepLinks';
import { APP_MODE } from '@/env';
import { colors } from '@/theme';

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

// Route map:
//   index          → redirects to the signed-in identity's space (or welcome)
//   welcome, onboarding, staff-signin, auth, reset → entry flows
//   (passenger)/…  → passenger app        (SpaceGate: passenger)
//   crew/…         → crew workspace       (SpaceGate: driver / conductor / attendant)
//   admin/…        → operations console   (SpaceGate: admin)
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AdapterProvider>
        <AuthProvider>
          <SessionProvider>
            <SearchProvider>
              <ToastProvider>
                <AuthGate />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="staff-signin" />
                  <Stack.Screen name="(passenger)" options={{ animation: 'fade' }} />
                  <Stack.Screen name="crew" options={{ animation: 'fade' }} />
                  <Stack.Screen name="admin" options={{ animation: 'fade' }} />
                  <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="reset" />
                  <Stack.Screen name="legal" />
                </Stack>
              </ToastProvider>
            </SearchProvider>
          </SessionProvider>
        </AuthProvider>
      </AdapterProvider>
    </SafeAreaProvider>
  );
}
