import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAppMode } from '../data/AdapterProvider';

/**
 * Keep a live screen fresh in connected mode: reload when the screen regains focus,
 * when the app returns to the foreground, and every `intervalMs` while visible.
 * (Preview mode refreshes instantly through the data epoch, so this is a no-op.)
 */
export function useLiveRefresh(reload: () => void, intervalMs = 30000) {
  const mode = useAppMode();
  const ref = useRef(reload);
  ref.current = reload;
  const focused = useRef(false);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    if (mode === 'connected') ref.current();
    return () => { focused.current = false; };
  }, [mode]));

  useEffect(() => {
    if (mode !== 'connected') return;
    const id = setInterval(() => { if (focused.current && AppState.currentState === 'active') ref.current(); }, intervalMs);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active' && focused.current) ref.current(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [mode, intervalMs]);
}
