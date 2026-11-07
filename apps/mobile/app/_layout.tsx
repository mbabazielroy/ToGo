// Starts crash reporting (release builds with EXPO_PUBLIC_SENTRY_DSN only) before
// anything else loads, so a crash during start-up is reported too.
import { reportError } from '@/lib/crashReporting';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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
/**
 * Last line of defence: if a screen throws while rendering, show a calm message
 * with a way back instead of a blank or red screen. Technical detail only in
 * development builds.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { reportError(error, 'screen'); }, [error]);
  return (
    <View style={eb.root} accessibilityRole="alert">
      <Text style={eb.title}>Something went wrong</Text>
      <Text style={eb.body}>This screen couldn’t be shown. Your reservations are safe. Try again, or restart the app if it keeps happening.</Text>
      {__DEV__ ? <Text style={eb.detail} numberOfLines={4}>{error.message}</Text> : null}
      <Pressable onPress={retry} accessibilityRole="button" style={({ pressed }) => [eb.button, pressed && { opacity: 0.85 }]}>
        <Text style={eb.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const eb = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  body: { fontSize: 16, color: colors.inkSoft, textAlign: 'center', lineHeight: 23 },
  detail: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  button: { marginTop: 8, backgroundColor: colors.forest700, borderRadius: 14, paddingHorizontal: 28, minHeight: 50, justifyContent: 'center' },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});

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
