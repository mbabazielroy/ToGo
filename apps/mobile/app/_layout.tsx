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

// Connected-mode route protection. In demo mode there is no auth, so this is inert.
function AuthGate() {
  const { loading, session, recoveryMode } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useAuthDeepLinks();

  useEffect(() => {
    if (APP_MODE !== 'connected' || loading) return;
    const top = segments[0] as string | undefined;
    const onAuth = top === 'auth';
    const onReset = top === 'reset';
    if (recoveryMode && !onReset) {
      router.replace('/reset');
    } else if (!session && !onAuth && !onReset) {
      router.replace('/auth');
    } else if (session && !recoveryMode && (onAuth || onReset)) {
      router.replace('/');
    }
  }, [loading, session, recoveryMode, segments, router]);

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
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.sand100 } }}>
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
