import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Direction } from '../types';
import { kampalaToday } from '../lib/time';

export interface SearchCriteria {
  direction: Direction;
  date: string; // YYYY-MM-DD
  passengers: number;
  hubId: string | null;
}

interface SearchContextValue {
  criteria: SearchCriteria;
  setCriteria: (patch: Partial<SearchCriteria>) => void;
  toggleDirection: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [criteria, setState] = useState<SearchCriteria>({
    direction: 'KLA_MBR',
    date: kampalaToday(),
    passengers: 1,
    hubId: null,
  });

  const value = useMemo<SearchContextValue>(
    () => ({
      criteria,
      setCriteria: (patch) => setState((c) => ({ ...c, ...patch })),
      toggleDirection: () =>
        setState((c) => ({
          ...c,
          direction: c.direction === 'KLA_MBR' ? 'MBR_KLA' : 'KLA_MBR',
          hubId: null, // reset hub when direction flips
        })),
    }),
    [criteria],
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within SearchProvider');
  return ctx;
}
