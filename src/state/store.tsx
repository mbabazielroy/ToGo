import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppState, DemoProfile, DemoRole } from '../types';
import { loadState, saveState } from '../lib/storage';
import { buildSeedState } from '../data/seed';
import { kampalaToday } from '../lib/time';
import * as logic from './logic';
import type { ReserveInput, Result, TripEditInput } from './logic';

interface StoreContextValue {
  state: AppState;
  // Booking actions
  reserve: (input: ReserveInput) => Result<import('../types').Booking>;
  cancelBooking: (bookingId: string) => Result<import('../types').Booking>;
  checkIn: (bookingId: string) => Result<import('../types').Booking>;
  checkInByReference: (reference: string) => Result<import('../types').Booking>;
  boardBooking: (bookingId: string) => Result<import('../types').Booking>;
  boardByCode: (tripId: string, code: string) => Result<import('../types').Booking>;
  // Trip actions
  startTrip: (tripId: string) => Result<import('../types').Trip>;
  reportDelay: (tripId: string, minutes: number) => Result<import('../types').Trip>;
  reachHub: (tripId: string, hubId: string) => Result<import('../types').Trip>;
  completeTrip: (tripId: string) => Result<import('../types').Trip>;
  cancelTrip: (tripId: string, reason: string) => Result<import('../types').Trip>;
  recordUnresolvedPickup: (tripId: string, hubId: string, reason: string) => Result<number>;
  editTrip: (tripId: string, edit: TripEditInput) => Result<import('../types').Trip>;
  advanceBus: (tripId: string, step?: number) => Result<import('../types').Trip>;
  // Meta
  setRole: (role: DemoRole) => void;
  updateProfile: (patch: Partial<DemoProfile>) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  // Guard against overlapping writes from rapid clicks within one tick.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    saveState(state);
  }, [state]);

  // Wrap a pure logic action so it applies to the latest state and returns its result.
  const run = useCallback(
    <T,>(fn: (s: AppState) => Result<T>): Result<T> => {
      const result = fn(stateRef.current);
      if (result.ok) {
        stateRef.current = result.state;
        setState(result.state);
      }
      return result;
    },
    [],
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      reserve: (input) => run((s) => logic.reserve(s, input)),
      cancelBooking: (id) => run((s) => logic.cancelBooking(s, id)),
      checkIn: (id) => run((s) => logic.checkIn(s, id)),
      checkInByReference: (ref) => run((s) => logic.checkInByReference(s, ref)),
      boardBooking: (id) => run((s) => logic.boardBooking(s, id)),
      boardByCode: (tripId, code) => run((s) => logic.boardByCode(s, tripId, code)),
      startTrip: (id) => run((s) => logic.startTrip(s, id)),
      reportDelay: (id, m) => run((s) => logic.reportDelay(s, id, m)),
      reachHub: (id, hub) => run((s) => logic.reachHub(s, id, hub)),
      completeTrip: (id) => run((s) => logic.completeTrip(s, id)),
      cancelTrip: (id, reason) => run((s) => logic.cancelTrip(s, id, reason)),
      recordUnresolvedPickup: (id, hub, reason) =>
        run((s) => logic.recordUnresolvedPickup(s, id, hub, reason)),
      editTrip: (id, edit) => run((s) => logic.editTrip(s, id, edit)),
      advanceBus: (id, step) => run((s) => logic.advanceBus(s, id, step)),
      setRole: (role) => setState((s) => ({ ...s, role })),
      updateProfile: (patch) => setState((s) => ({ ...s, profile: { ...s.profile, ...patch } })),
      resetDemo: () => {
        const fresh = buildSeedState(kampalaToday());
        stateRef.current = fresh;
        setState(fresh);
      },
    }),
    [state, run],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}
