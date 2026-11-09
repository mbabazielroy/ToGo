import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { ThemeContext, palettes, type AppearancePreference, type Scheme, type ThemeValue } from '@/theme';

const KEY = 'togo.appearance';

function isPreference(v: unknown): v is AppearancePreference {
  return v === 'system' || v === 'light' || v === 'dark';
}

/**
 * Light or dark palette for the whole app. Follows the phone's appearance (and
 * changes with it, e.g. at sunset) unless the person picks Light or Dark in
 * Account → Appearance; that choice is kept on this device.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<AppearancePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (isPreference(v)) setPref(v); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  // Native alerts, keyboards and pickers follow the app's choice too.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try { Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference); } catch { /* older runtimes */ }
  }, [preference]);

  const system = useColorScheme();
  const scheme: Scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  // The window behind the app (shown during transitions and keyboard animations).
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palettes[scheme].bg).catch(() => {});
  }, [scheme]);

  const setPreference = useCallback((p: AppearancePreference) => {
    setPref(p);
    AsyncStorage.setItem(KEY, p).catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => ({ scheme, preference, setPreference }), [scheme, preference, setPreference]);

  // Wait for the saved choice (a few milliseconds) so the app doesn't flash the
  // wrong palette on launch.
  if (!ready) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
