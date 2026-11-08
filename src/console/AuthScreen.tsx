import { useEffect, useState } from 'react';
import { Loader2, Mail, Lock, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth } from './auth/AuthProvider';
import { IDLE_MINUTES, IDLE_NOTICE_KEY } from './auth/idle';
import {
  authErrorMessage, cleanCode, codeLooksValid, emailLooksValid, newPasswordProblem,
  EMAIL_CODE_LENGTH, EMAIL_CODE_MINUTES, RESEND_SECONDS, PASSWORD_MAX,
} from '../lib/authRules';

type Tab = 'signin' | 'forgot' | 'reset';

/** Staff sign-in for the operations console. Accounts are created in the ToGo
 *  apps; an administrator then grants operator or admin access. A forgotten
 *  password is reset with the code from the email, which works in any browser
 *  (the email's link works only in the browser that asked for it). */

export function AuthScreen() {
  const { signIn, resetPassword, resetWithCode } = useAuth();
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(IDLE_NOTICE_KEY)) {
        sessionStorage.removeItem(IDLE_NOTICE_KEY);
        setInfo(`You were signed out after ${IDLE_MINUTES} minutes without activity.`);
      }
    } catch { /* storage blocked */ }
  }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function go(t: Tab) { setTab(t); setErr(null); setCode(''); setPassword(''); }

  async function sendCode() {
    await resetPassword(email.trim());
    setCooldown(RESEND_SECONDS);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    if (!emailLooksValid(email)) { setErr('Enter a valid email address.'); return; }
    if (tab === 'reset') {
      if (!codeLooksValid(code)) { setErr(`Enter the ${EMAIL_CODE_LENGTH}-digit code from the email.`); return; }
      const problem = newPasswordProblem(password, { email });
      if (problem) { setErr(problem); return; }
    }
    setBusy(true);
    try {
      if (tab === 'signin') await signIn(email.trim(), password);
      else if (tab === 'forgot') { await sendCode(); go('reset'); }
      else await resetWithCode(email.trim(), code, password);
    } catch (e) {
      setErr(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (cooldown > 0) return;
    setErr(null);
    try { await sendCode(); setInfo('If that account needs it, a new code is on its way.'); }
    catch (e) { setErr(authErrorMessage(e)); }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <img src="/logo.png" alt="" width={56} height={56} className="h-14 w-14 rounded-2xl shadow-raised" />
        <h1 className="text-2xl font-extrabold text-forest-900">ToGo operations</h1>
        <p className="text-sm text-forest-500">Sign in with your ToGo staff account.</p>
      </div>

      <div className="card p-5">
        {info && (
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-lime-50 px-3 py-2 text-sm text-forest-700 ring-1 ring-lime-200">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {info}
          </div>
        )}
        {err && (
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {err}
          </div>
        )}

        {tab === 'forgot' && <p className="mb-3 text-sm text-forest-600">Enter your staff email. We’ll send a code to set a new password.</p>}
        {tab === 'reset' && (
          <p className="mb-3 text-sm text-forest-600">
            If {email.trim()} has a ToGo account, we’ve sent it a {EMAIL_CODE_LENGTH}-digit code. It lasts {EMAIL_CODE_MINUTES} minutes.
          </p>
        )}

        <form onSubmit={submit} className="space-y-3" noValidate>
          {tab !== 'reset' && (
            <Field icon={<Mail size={16} />} label="Email">
              <input type="email" required className="input pl-10" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" autoCapitalize="none" spellCheck={false} />
            </Field>
          )}
          {tab === 'reset' && (
            <Field icon={<KeyRound size={16} />} label="Code from the email">
              <input inputMode="numeric" required className="input pl-10 tracking-[0.3em]" value={code}
                onChange={(e) => setCode(cleanCode(e.target.value))} placeholder={'0'.repeat(EMAIL_CODE_LENGTH)} autoComplete="one-time-code" />
            </Field>
          )}
          {tab !== 'forgot' && (
            <Field icon={<Lock size={16} />} label={tab === 'reset' ? 'New password' : 'Password'}>
              <input type="password" required maxLength={PASSWORD_MAX * 2} className="input pl-10" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder={tab === 'reset' ? 'At least 8 characters' : '••••••••'}
                autoComplete={tab === 'reset' ? 'new-password' : 'current-password'} />
            </Field>
          )}
          {tab === 'reset' && password && (
            <p className={`text-xs ${newPasswordProblem(password, { email }) ? 'text-red-700' : 'text-forest-600'}`} aria-live="polite">
              {newPasswordProblem(password, { email }) ?? 'Good. Longer is stronger: try a few unrelated words.'}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {tab === 'signin' ? 'Sign in' : tab === 'forgot' ? 'Email me a reset code' : 'Set new password'}
          </button>
        </form>

        {tab === 'signin' && (
          <button onClick={() => go('forgot')}
            className="mt-3 w-full text-center text-sm font-medium text-forest-500">
            Forgot your password?
          </button>
        )}
        {tab === 'reset' && (
          <button onClick={resend} disabled={cooldown > 0}
            className="mt-3 w-full text-center text-sm font-medium text-forest-500 disabled:text-forest-300">
            {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
          </button>
        )}
        {tab !== 'signin' && (
          <button onClick={() => go('signin')}
            className="mt-2 w-full text-center text-sm font-medium text-forest-500">
            Back to sign in
          </button>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-forest-500">
        For ToGo operators and administrators. Passengers and crews use the ToGo and
        ToGo Staff apps. <a href="/" className="font-semibold underline">About ToGo</a>
      </p>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-forest-400">{icon}</span>
        {children}
      </span>
    </label>
  );
}
