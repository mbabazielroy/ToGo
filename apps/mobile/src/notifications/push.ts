import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { reportError } from '../lib/crashReporting';

// Push alerts for delays, cancellations and schedule changes (connected mode).
// The phone's Expo push token is stored on the server with
// register_push_token (supabase/migrations/0020_push_tokens.sql), and a server
// function sends the alert (supabase/functions/push). Store builds only: Expo Go
// can't receive these, and Android needs the app's Firebase setup (docs/BACKEND.md).

const KEY = 'togo.push.token';
/** Android channel for service alerts; the push function sends to the same id. */
export const ALERT_CHANNEL = 'service-alerts';

async function deviceToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data || null;
}

/** Register this phone for push alerts. Call only once notifications are allowed. */
export async function registerForPush(): Promise<void> {
  if (!supabase) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
        name: 'Delays and changes',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const token = await deviceToken();
    if (!token) return;
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token, p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    if (error) throw error;
    await AsyncStorage.setItem(KEY, token);
  } catch (e) {
    // No push without a store build or Firebase setup; alerts still show in the app.
    reportError(e, 'push-register');
  }
}

/** Stop push alerts to this phone (sign-out, or alerts turned off). Needs the session. */
export async function unregisterFromPush(): Promise<void> {
  const token = await AsyncStorage.getItem(KEY).catch(() => null);
  if (!token) return;
  await AsyncStorage.removeItem(KEY).catch(() => {});
  if (!supabase) return;
  try {
    const { error } = await supabase.rpc('unregister_push_token', { p_token: token });
    if (error) throw error;
  } catch (e) {
    reportError(e, 'push-unregister');
  }
}
