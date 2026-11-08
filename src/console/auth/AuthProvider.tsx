import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { normaliseEmail } from '../../lib/authRules';
import { markActive } from './idle';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  is_platform_admin: boolean;
}

export interface Assignments {
  isAdmin: boolean;
  operatorIds: string[];   // operator staff
  hubIds: string[];        // hub attendant
  conductorTripIds: string[]; // conductor
  driverTripIds: string[]; // driver
}

const EMPTY_ASSIGNMENTS: Assignments = { isAdmin: false, operatorIds: [], hubIds: [], conductorTripIds: [], driverTripIds: [] };

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  assignments: Assignments;
  error: string | null;
  /** True after a password-recovery link is opened; the app should show the new-password form. */
  recoveryMode: boolean;
  clearRecoveryMode: () => void;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Sign out this browser only (the person's phones stay signed in). */
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Forgotten password: the emailed code plus a new password; works in any browser. */
  resetWithCode: (email: string, code: string, newPassword: string) => Promise<void>;
  /** Set a new password after a reset link; signs out every other session. */
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignments, setAssignments] = useState<Assignments>(EMPTY_ASSIGNMENTS);
  const [error, setError] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  // resetWithCode sets the password itself, so its recovery sign-in must not
  // switch the screen to the separate new-password page.
  const codeReset = useRef(false);

  const loadWorkspaces = useCallback(async (uid: string) => {
    if (!supabase) return;
    // Each query is scoped by RLS to the current user's own rows.
    const [prof, members, hubs, trips] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('operator_members').select('operator_id').eq('user_id', uid),
      supabase.from('hub_staff').select('hub_id').eq('user_id', uid),
      supabase.from('trip_staff').select('trip_id, role').eq('user_id', uid),
    ]);
    const p = (prof.data as Profile | null) ?? null;
    setProfile(p);
    const tripRows = (trips.data ?? []) as { trip_id: string; role: string }[];
    setAssignments({
      isAdmin: !!p?.is_platform_admin,
      operatorIds: (members.data ?? []).map((r: { operator_id: string }) => r.operator_id),
      hubIds: (hubs.data ?? []).map((r: { hub_id: string }) => r.hub_id),
      conductorTripIds: tripRows.filter((r) => r.role === 'conductor').map((r) => r.trip_id),
      driverTripIds: tripRows.filter((r) => r.role === 'driver').map((r) => r.trip_id),
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    setSession(data.session ?? null);
    if (data.session?.user) {
      try {
        await loadWorkspaces(data.session.user.id);
      } catch (e) {
        setError((e as Error).message);
      }
    } else {
      setProfile(null);
      setAssignments(EMPTY_ASSIGNMENTS);
    }
  }, [loadWorkspaces]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    refresh().finally(() => active && setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // A password-recovery link produces a temporary session + this event; the app
      // must send the user to the new-password form instead of the normal app.
      if (event === 'PASSWORD_RECOVERY' && !codeReset.current) setRecoveryMode(true);
      setSession(s ?? null);
      if (s?.user) {
        loadWorkspaces(s.user.id).catch((e) => setError((e as Error).message));
      } else {
        setProfile(null);
        setAssignments(EMPTY_ASSIGNMENTS);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [refresh, loadWorkspaces]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Not connected');
    setError(null);
    markActive();
    const { error } = await supabase.auth.signInWithPassword({ email: normaliseEmail(email), password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut({ scope: 'local' });
    setProfile(null);
    setAssignments(EMPTY_ASSIGNMENTS);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Not connected');
    // redirectTo must be an allow-listed, same-origin URL (safe redirect).
    // Succeeds whether or not the email has an account (no account enumeration).
    const { error } = await supabase.auth.resetPasswordForEmail(normaliseEmail(email), {
      redirectTo: `${window.location.origin}/console/auth/reset`,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    if (!supabase) throw new Error('Not connected');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    markActive();
    setRecoveryMode(false);
    // Whoever had the old password or an old session is signed out.
    await supabase.auth.signOut({ scope: 'others' }).catch(() => {});
  }, []);

  const resetWithCode = useCallback(async (email: string, code: string, newPassword: string) => {
    if (!supabase) throw new Error('Not connected');
    codeReset.current = true;
    markActive();
    try {
      const { error } = await supabase.auth.verifyOtp({ email: normaliseEmail(email), token: code, type: 'recovery' });
      if (error) throw error;
      const { error: upErr } = await supabase.auth.updateUser({ password: newPassword });
      if (upErr) { setRecoveryMode(true); throw upErr; }
      await supabase.auth.signOut({ scope: 'others' }).catch(() => {});
    } finally {
      codeReset.current = false;
    }
  }, []);

  const clearRecoveryMode = useCallback(() => setRecoveryMode(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading, session, user: session?.user ?? null, profile, assignments, error,
      recoveryMode, clearRecoveryMode,
      refresh, signIn, signOut, resetPassword, resetWithCode, updatePassword,
    }),
    [loading, session, profile, assignments, error, recoveryMode, clearRecoveryMode,
     refresh, signIn, signOut, resetPassword, resetWithCode, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
