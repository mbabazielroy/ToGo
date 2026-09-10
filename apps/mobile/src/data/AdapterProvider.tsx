import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { View, ActivityIndicator } from 'react-native';
import type { DataAdapter } from '@shared/data/adapter';
import { DemoAdapter } from '@shared/data/demoAdapter';
import { SupabaseAdapter } from '@shared/data/supabaseAdapter';
import { buildSeedState } from '@shared/data/seed';
import { kampalaToday } from '@shared/lib/time';
import { APP_MODE } from '../env';
import { supabase } from '../lib/supabase';
import { loadDemoState, saveDemoState, clearDemoState } from '../lib/demoStorage';
import { colors } from '../theme';

interface AdapterCtx {
  adapter: DataAdapter;
  mode: 'demo' | 'connected';
  /** Demo only: wipe local demo data and reseed. No-op in connected mode. */
  resetDemo: () => Promise<void>;
  /** Bump to force dependent screens to refetch (used after resetDemo). */
  epoch: number;
}

const Ctx = createContext<AdapterCtx | null>(null);

export function AdapterProvider({ children }: { children: ReactNode }) {
  const connected = APP_MODE === 'connected' && !!supabase;
  const [adapter, setAdapter] = useState<DataAdapter | null>(
    connected ? new SupabaseAdapter(supabase!) : null,
  );
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (connected) return; // connected adapter is ready synchronously
    let active = true;
    loadDemoState().then((initial) => {
      if (active) setAdapter(new DemoAdapter(initial, saveDemoState));
    });
    return () => { active = false; };
  }, [connected]);

  const resetDemo = useCallback(async () => {
    if (connected) return;
    await clearDemoState();
    const fresh = buildSeedState(kampalaToday());
    saveDemoState(fresh);
    setAdapter(new DemoAdapter(fresh, saveDemoState));
    setEpoch((e) => e + 1);
  }, [connected]);

  const value = useMemo<AdapterCtx | null>(
    () => (adapter ? { adapter, mode: connected ? 'connected' : 'demo', resetDemo, epoch } : null),
    [adapter, connected, resetDemo, epoch],
  );

  if (!value) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand100 }}>
        <ActivityIndicator color={colors.forest700} />
      </View>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdapter(): DataAdapter {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAdapter must be used within AdapterProvider');
  return c.adapter;
}

export function useAppMode(): 'demo' | 'connected' {
  const c = useContext(Ctx);
  return c?.mode ?? 'demo';
}

export function useResetDemo(): () => Promise<void> {
  const c = useContext(Ctx);
  return c?.resetDemo ?? (async () => {});
}

export function useDataEpoch(): number {
  return useContext(Ctx)?.epoch ?? 0;
}
