import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DataAdapter } from '@shared/data/adapter';
import { DemoAdapter } from '@shared/data/demoAdapter';
import { SupabaseAdapter } from '@shared/data/supabaseAdapter';
import { buildSeedState } from '@shared/data/seed';
import { kampalaToday } from '@shared/lib/time';
import { APP_MODE, DEMO_ENABLED, isSupabaseConfigured } from '../env';
import { supabase, pingSupabase } from '../lib/supabase';
import { loadDemoState, saveDemoState, clearDemoState } from '../lib/demoStorage';
import { ConnectionScreen, ConnectionChecking, type ConnState } from '../components/ConnectionScreen';

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
  const connected = APP_MODE === 'connected';

  const [adapter, setAdapter] = useState<DataAdapter | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [connState, setConnState] = useState<ConnState>(connected ? 'checking' : 'ready');
  const [connError, setConnError] = useState<string | undefined>(undefined);
  const [retrying, setRetrying] = useState(false);
  const supaAdapter = useRef<SupabaseAdapter | null>(null);

  // Demo mode: back the shared rules with AsyncStorage. (Explicit dev/test flag only.)
  useEffect(() => {
    if (connected) return;
    let active = true;
    loadDemoState().then((initial) => {
      if (active) setAdapter(new DemoAdapter(initial, saveDemoState));
    });
    return () => { active = false; };
  }, [connected]);

  const check = useCallback(async () => {
    if (!connected) return;
    if (!isSupabaseConfigured || !supabase) { setConnState('unconfigured'); return; }
    setRetrying(true);
    const res = await pingSupabase();
    setRetrying(false);
    if (res.ok) {
      if (!supaAdapter.current) supaAdapter.current = new SupabaseAdapter(supabase);
      setAdapter(supaAdapter.current);
      setConnState('ready');
    } else {
      setConnError(res.error);
      setConnState('unreachable');
    }
  }, [connected]);

  useEffect(() => { check(); }, [check]);

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

  // Connected-mode failure UX — never a silent demo fallback.
  if (connected && connState !== 'ready') {
    if (connState === 'checking') return <ConnectionChecking />;
    return <ConnectionScreen state={connState} detail={connError} onRetry={check} retrying={retrying} />;
  }

  if (!value) return <ConnectionChecking />;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdapter(): DataAdapter {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAdapter must be used within AdapterProvider');
  return c.adapter;
}

export function useAppMode(): 'demo' | 'connected' {
  const c = useContext(Ctx);
  return c?.mode ?? (DEMO_ENABLED ? 'demo' : 'connected');
}

export function useResetDemo(): () => Promise<void> {
  const c = useContext(Ctx);
  return c?.resetDemo ?? (async () => {});
}

export function useDataEpoch(): number {
  return useContext(Ctx)?.epoch ?? 0;
}
