import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  is_platform_admin: boolean;
}

interface AuthCtx {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  error: string | null;
  recoveryMode: boolean;
  clearRecoveryMode: () => void;
  setRecoveryMode: (v: boolean) => void;
  refresh: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string, redirectTo?: string) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string, redirectTo?: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const loadProfile = useCallback(async (uid: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    setSession(data.session ?? null);
    if (data.session?.user) {
      try { await loadProfile(data.session.user.id); } catch (e) { setError((e as Error).message); }
    } else {
      setProfile(null);
    }
  }, [loadProfile]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    refresh().finally(() => active && setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      setSession(s ?? null);
      if (s?.user) loadProfile(s.user.id).catch((e) => setError((e as Error).message));
      else setProfile(null);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [refresh, loadProfile]);

  const signUp = useCallback(async (email: string, password: string, fullName: string, redirectTo?: string) => {
    if (!supabase) throw new Error('Not connected');
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName }, emailRedirectTo: redirectTo },
    });
    if (error) throw error;
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
    setSession(null);
  }, []);

  const resetPassword = useCallback(async (email: string, redirectTo?: string) => {
    if (!supabase) throw new Error('Not connected');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    if (!supabase) throw new Error('Not connected');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setRecoveryMode(false);
  }, []);

  const clearRecoveryMode = useCallback(() => setRecoveryMode(false), []);

  const value = useMemo<AuthCtx>(() => ({
    loading, session, user: session?.user ?? null, profile, error, recoveryMode,
    clearRecoveryMode, setRecoveryMode, refresh, signUp, signIn, signOut, resetPassword, updatePassword,
  }), [loading, session, profile, error, recoveryMode, clearRecoveryMode, refresh, signUp, signIn, signOut, resetPassword, updatePassword]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
