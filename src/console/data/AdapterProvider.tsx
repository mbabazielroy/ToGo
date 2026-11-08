import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { DataAdapter } from '../../data/adapter';
import { SupabaseAdapter } from '../../data/supabaseAdapter';
import { requireSupabase } from '../lib/supabase';

const AdapterContext = createContext<DataAdapter | null>(null);

/** The operations console always talks to the real backend (no demo mode). */
export function AdapterProvider({ children }: { children: ReactNode }) {
  const adapter = useMemo<DataAdapter>(() => new SupabaseAdapter(requireSupabase()), []);
  return <AdapterContext.Provider value={adapter}>{children}</AdapterContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdapter(): DataAdapter {
  const ctx = useContext(AdapterContext);
  if (!ctx) throw new Error('useAdapter must be used within AdapterProvider');
  return ctx;
}
