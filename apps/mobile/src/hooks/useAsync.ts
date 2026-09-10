import { useCallback, useEffect, useRef, useState } from 'react';
import { AdapterError } from '@shared/data/adapter';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Load async data with loading/error/retry and safe-unmount handling. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => { if (active && mounted.current) setData(d); })
      .catch((e) => { if (active && mounted.current) setError(humanError(e)); })
      .finally(() => { if (active && mounted.current) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

/** Friendly, honest messages for backend/adapter errors. */
export function humanError(e: unknown): string {
  if (e instanceof AdapterError) {
    switch (e.code) {
      case 'SOLD_OUT': return e.message || 'That trip just sold out.';
      case 'BOOKING_CLOSED': return 'Reservations are closed for this departure.';
      case 'IDEMPOTENCY_CONFLICT': return 'That request was reused with different details. Please retry.';
      case 'AUTH_REQUIRED': return 'Please sign in to continue.';
      case 'FORBIDDEN': return 'You do not have permission for that.';
      case 'INVALID_CODE': return 'That boarding code was not recognised.';
      case 'WRONG_TRIP': return 'That code belongs to a different trip.';
      case 'ALREADY_BOARDED': return 'That passenger is already boarded.';
      case 'CANCELLED': return 'That booking was cancelled.';
      case 'CAPACITY_TOO_LOW': return e.message;
      default: return e.message || 'Something went wrong.';
    }
  }
  const msg = (e as Error)?.message ?? '';
  if (/network|fetch|Failed to fetch|timeout/i.test(msg)) return 'Network problem — check your connection and retry.';
  return msg || 'Something went wrong.';
}
