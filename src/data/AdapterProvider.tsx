import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { DataAdapter } from './adapter';
import { SupabaseAdapter } from './supabaseAdapter';
import { DemoAdapter } from './demoAdapter';
import { supabase } from '../lib/supabase';
import { APP_MODE } from '../lib/env';

const AdapterContext = createContext<DataAdapter | null>(null);

export function AdapterProvider({ children }: { children: ReactNode }) {
  const adapter = useMemo<DataAdapter>(() => {
    if (APP_MODE === 'connected' && supabase) return new SupabaseAdapter(supabase);
    return new DemoAdapter();
  }, []);
  return <AdapterContext.Provider value={adapter}>{children}</AdapterContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdapter(): DataAdapter {
  const ctx = useContext(AdapterContext);
  if (!ctx) throw new Error('useAdapter must be used within AdapterProvider');
  return ctx;
}
