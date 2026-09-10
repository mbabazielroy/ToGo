import { useState } from 'react';
import { Bus, Loader2, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';

type Tab = 'signin' | 'signup' | 'reset';

export function AuthScreen() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setBusy(true);
    try {
      if (tab === 'signin') {
        await signIn(email.trim(), password);
      } else if (tab === 'signup') {
        const { needsConfirmation } = await signUp(email.trim(), password, fullName.trim() || 'Traveller');
        if (needsConfirmation) {
          setInfo('Check your email to confirm your account, then sign in.');
          setTab('signin');
        }
      } else {
        await resetPassword(email.trim());
        setInfo('If that email exists, a password reset link is on its way.');
        setTab('signin');
      }
    } catch (e) {
      setErr((e as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-700 text-lime-300 shadow-raised">
          <Bus size={26} strokeWidth={2.5} />
        </span>
        <h1 className="text-2xl font-extrabold text-forest-900">
          To<span className="text-lime-500">Go</span>
        </h1>
        <p className="text-sm text-forest-500">Your bus. Your stop. — Pilot sign in.</p>
      </div>

      <div className="card p-5">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-sand-100 p-1">
          <button
            onClick={() => { setTab('signin'); setErr(null); }}
            className={`rounded-lg py-2 text-sm font-semibold ${tab !== 'signup' ? 'bg-white text-forest-800 shadow-card' : 'text-forest-500'}`}
          >
            Sign in
          </button>
          <button
            onClick={() => { setTab('signup'); setErr(null); }}
            className={`rounded-lg py-2 text-sm font-semibold ${tab === 'signup' ? 'bg-white text-forest-800 shadow-card' : 'text-forest-500'}`}
          >
            Create account
          </button>
        </div>

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

        <form onSubmit={submit} className="space-y-3">
          {tab === 'signup' && (
            <Field icon={<UserIcon size={16} />} label="Full name">
              <input className="input pl-10" value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder="Amina N." autoComplete="name" />
            </Field>
          )}
          <Field icon={<Mail size={16} />} label="Email">
            <input type="email" required className="input pl-10" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </Field>
          {tab !== 'reset' && (
            <Field icon={<Lock size={16} />} label="Password">
              <input type="password" required minLength={6} className="input pl-10" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'} />
            </Field>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {tab === 'signin' ? 'Sign in' : tab === 'signup' ? 'Create passenger account' : 'Send reset link'}
          </button>
        </form>

        {tab === 'signin' && (
          <button onClick={() => { setTab('reset'); setErr(null); }}
            className="mt-3 w-full text-center text-sm font-medium text-forest-500">
            Forgot your password?
          </button>
        )}
        {tab === 'signup' && (
          <p className="mt-3 text-center text-xs text-forest-400">
            Public signup creates a passenger account only. Staff access is granted by an administrator.
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-[11px] text-forest-400">
        Connected pilot · Real accounts and shared data. Demonstration only — no real transport service.
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
