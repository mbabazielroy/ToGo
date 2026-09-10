import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { DirectionCode } from '@shared/data/adapter';
import { kampalaToday } from '@shared/lib/time';

interface SearchCriteria {
  direction: DirectionCode;
  date: string; // YYYY-MM-DD
  passengers: number;
  hubId: string | null;
}
interface SearchCtx {
  criteria: SearchCriteria;
  set: (patch: Partial<SearchCriteria>) => void;
  toggleDirection: () => void;
}
const Ctx = createContext<SearchCtx | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [criteria, setState] = useState<SearchCriteria>({
    direction: 'KLA_MBR', date: kampalaToday(), passengers: 1, hubId: null,
  });
  const value = useMemo<SearchCtx>(() => ({
    criteria,
    set: (patch) => setState((c) => ({ ...c, ...patch })),
    toggleDirection: () => setState((c) => ({
      ...c, direction: c.direction === 'KLA_MBR' ? 'MBR_KLA' : 'KLA_MBR', hubId: null,
    })),
  }), [criteria]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSearch(): SearchCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSearch must be used within SearchProvider');
  return c;
}
