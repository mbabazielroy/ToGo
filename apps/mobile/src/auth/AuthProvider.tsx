import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { normaliseEmail } from '@shared/lib/authRules';
import { reportError } from '../lib/crashReporting';

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
  /** Finish sign-up with the code from the confirmation email. */
  verifySignupCode: (email: string, code: string) => Promise<void>;
  /** Send the confirmation email again. */
  resendSignupCode: (email: string, redirectTo?: string) => Promise<void>;
  /** Sign out this phone, or every device (`everywhere`). */
  signOut: (everywhere?: boolean) => Promise<void>;
  resetPassword: (email: string, redirectTo?: string) => Promise<void>;
  /** Forgotten password: the emailed code plus a new password. Works on any device. */
  resetWithCode: (email: string, code: string, newPassword: string) => Promise<void>;
  /** Set a new password after a reset link (the link already proved who it is). */
  updatePassword: (newPassword: string) => Promise<void>;
  /** Signed in: change the password, which needs the current one. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Signed in: move the account to a new email. Needs the current password;
   *  finishes when the links sent to both the old and new address are opened. */
  changeEmail: (newEmail: string, currentPassword: string, redirectTo?: string) => Promise<void>;
  updateProfile: (patch: { full_name?: string; phone?: string | null }) => Promise<void>;
  /** Permanently delete the signed-in account on the server, then sign out. */
  deleteAccount: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  // While resetWithCode runs, its own recovery sign-in shouldn't send the person to
  // the separate new-password screen: the new password is set in the same step.
  const codeReset = useRef(false);

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
      if (event === 'PASSWORD_RECOVERY' && !codeReset.current) setRecoveryMode(true);
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
      email: normaliseEmail(email), password,
      options: { data: { full_name: fullName }, emailRedirectTo: redirectTo },
    });
    if (error) throw error;
    // With confirmations on, Supabase answers the same way for a new email and
    // one that already has an account, so the app can't (and doesn't) tell them apart.
    return { needsConfirmation: !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Not connected');
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: normaliseEmail(email), password });
    if (error) throw error;
  }, []);

  const verifySignupCode = useCallback(async (email: string, code: string) => {
    if (!supabase) throw new Error('Not connected');
    const { error } = await supabase.auth.verifyOtp({ email: normaliseEmail(email), token: code, type: 'email' });
    if (error) throw error;
  }, []);

  const resendSignupCode = useCallback(async (email: string, redirectTo?: string) => {
    if (!supabase) throw new Error('Not connected');
    const { error } = await supabase.auth.resend({ type: 'signup', email: normaliseEmail(email), options: { emailRedirectTo: redirectTo } });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async (everywhere = false) => {
    if (!supabase) return;
    // Signing out of this phone shouldn't end the person's other sessions (the
    // console, another phone); "Sign out everywhere" does that on purpose.
    const { error } = await supabase.auth.signOut({ scope: everywhere ? 'global' : 'local' });
    if (error && everywhere) throw error;
    if (error) await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    setProfile(null);
    setSession(null);
  }, []);

  /** After a password is set, end every other session: whoever knew the old
   *  password (or held an old session) is signed out. */
  const signOutOthers = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) reportError(error, 'signout-others');
  }, []);

  const resetPassword = useCallback(async (email: string, redirectTo?: string) => {
    if (!supabase) throw new Error('Not connected');
    // Succeeds whether or not the email has an account (no account enumeration).
    const { error } = await supabase.auth.resetPasswordForEmail(normaliseEmail(email), { redirectTo });
    if (error) throw error;
  }, []);

  const resetWithCode = useCallback(async (email: string, code: string, newPassword: string) => {
    if (!supabase) throw new Error('Not connected');
    codeReset.current = true;
    try {
      const { error } = await supabase.auth.verifyOtp({ email: normaliseEmail(email), token: code, type: 'recovery' });
      if (error) throw error;
      const { error: upErr } = await supabase.auth.updateUser({ password: newPassword });
      if (upErr) {
        // The code worked (they're signed in) but the password was refused: send
        // them to the new-password screen to choose another.
        setRecoveryMode(true);
        throw upErr;
      }
      await signOutOthers();
    } finally {
      codeReset.current = false;
    }
  }, [signOutOthers]);

  const updatePassword = useCallback(async (newPassword: string) => {
    if (!supabase) throw new Error('Not connected');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setRecoveryMode(false);
    await signOutOthers();
  }, [signOutOthers]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!supabase || !session?.user?.email) throw new Error('Not signed in');
    // Someone holding an unlocked phone mustn't be able to take over the account:
    // check the current password first (this also counts as a recent sign-in for
    // the server's secure_password_change rule).
    const { error: checkErr } = await supabase.auth.signInWithPassword({ email: session.user.email, password: currentPassword });
    if (checkErr) {
      throw Object.assign(new Error('Your current password isn’t right.'), { code: 'wrong_current_password' });
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword, current_password: currentPassword });
    if (error) throw error;
    await signOutOthers();
  }, [session, signOutOthers]);

  const changeEmail = useCallback(async (newEmail: string, currentPassword: string, redirectTo?: string) => {
    if (!supabase || !session?.user?.email) throw new Error('Not signed in');
    const { error: checkErr } = await supabase.auth.signInWithPassword({ email: session.user.email, password: currentPassword });
    if (checkErr) {
      throw Object.assign(new Error('Your current password isn’t right.'), { code: 'wrong_current_password' });
    }
    // With "secure email change" on, Supabase emails both addresses; the change
    // happens only once both are confirmed, so a stolen session can't move the account.
    const { data, error } = await supabase.auth.updateUser({ email: normaliseEmail(newEmail) }, { emailRedirectTo: redirectTo });
    if (error) throw error;
    // Keep the pending address (user.new_email) so the screen can show it.
    if (data.user) setSession((s) => (s ? { ...s, user: data.user } : s));
  }, [session]);

  const updateProfile = useCallback(async (patch: { full_name?: string; phone?: string | null }) => {
    if (!supabase || !session?.user) throw new Error('Not signed in');
    const { error } = await supabase.from('profiles').update(patch).eq('id', session.user.id);
    if (error) throw error;
    await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const deleteAccount = useCallback(async () => {
    if (!supabase || !session?.user) throw new Error('Not signed in');
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    // The server session is gone with the user; clear the local copy too.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    setProfile(null);
    setSession(null);
  }, [session]);

  const clearRecoveryMode = useCallback(() => setRecoveryMode(false), []);

  const value = useMemo<AuthCtx>(() => ({
    loading, session, user: session?.user ?? null, profile, error, recoveryMode,
    clearRecoveryMode, setRecoveryMode, refresh, signUp, signIn, verifySignupCode, resendSignupCode, signOut,
    resetPassword, resetWithCode, updatePassword, changePassword, changeEmail, updateProfile, deleteAccount,
  }), [loading, session, profile, error, recoveryMode, clearRecoveryMode, refresh, signUp, signIn, verifySignupCode,
    resendSignupCode, signOut, resetPassword, resetWithCode, updatePassword, changePassword, changeEmail, updateProfile, deleteAccount]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
