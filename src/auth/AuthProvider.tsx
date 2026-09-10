import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
}

const EMPTY_ASSIGNMENTS: Assignments = { isAdmin: false, operatorIds: [], hubIds: [], conductorTripIds: [] };

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  assignments: Assignments;
  error: string | null;
  refresh: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignments, setAssignments] = useState<Assignments>(EMPTY_ASSIGNMENTS);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async (uid: string) => {
    if (!supabase) return;
    // Each query is scoped by RLS to the current user's own rows.
    const [prof, members, hubs, trips] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('operator_members').select('operator_id').eq('user_id', uid),
      supabase.from('hub_staff').select('hub_id').eq('user_id', uid),
      supabase.from('trip_staff').select('trip_id').eq('user_id', uid),
    ]);
    const p = (prof.data as Profile | null) ?? null;
    setProfile(p);
    setAssignments({
      isAdmin: !!p?.is_platform_admin,
      operatorIds: (members.data ?? []).map((r: { operator_id: string }) => r.operator_id),
      hubIds: (hubs.data ?? []).map((r: { hub_id: string }) => r.hub_id),
      conductorTripIds: (trips.data ?? []).map((r: { trip_id: string }) => r.trip_id),
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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
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

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) throw new Error('Not connected');
    setError(null);
    // Public signup ALWAYS creates a passenger — no role/admin metadata is trusted.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) throw error;
    // If email confirmation is required, there is no session yet.
    return { needsConfirmation: !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Not connected');
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
    setAssignments(EMPTY_ASSIGNMENTS);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Not connected');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) throw error;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading, session, user: session?.user ?? null, profile, assignments, error,
      refresh, signUp, signIn, signOut, resetPassword,
    }),
    [loading, session, profile, assignments, error, refresh, signUp, signIn, signOut, resetPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
