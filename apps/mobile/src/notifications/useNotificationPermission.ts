import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export type NotificationPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/**
 * Whether the phone lets ToGo show notifications, re-checked when the app comes
 * back to the foreground (the person may have just changed it in Settings).
 */
export function useNotificationPermission() {
  const [status, setStatus] = useState<NotificationPermission>(Platform.OS === 'web' ? 'unavailable' : 'undetermined');
  const [canAskAgain, setCanAskAgain] = useState(true);

  const check = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const p = await Notifications.getPermissionsAsync();
      setStatus(p.granted ? 'granted' : p.status === 'denied' ? 'denied' : 'undetermined');
      setCanAskAgain(p.canAskAgain);
    } catch {
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => sub.remove();
  }, [check]);

  /** Ask if the phone still allows asking; otherwise open ToGo's settings page. */
  const request = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;
    try {
      if (canAskAgain) {
        const p = await Notifications.requestPermissionsAsync();
        setStatus(p.granted ? 'granted' : p.status === 'denied' ? 'denied' : 'undetermined');
        setCanAskAgain(p.canAskAgain);
        if (p.granted) return true;
        if (p.canAskAgain) return false;
      }
      await Linking.openSettings();
    } catch { /* nothing more to do */ }
    return false;
  }, [canAskAgain]);

  return { status, request, openSettings: () => Linking.openSettings().catch(() => {}) };
}
