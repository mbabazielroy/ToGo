import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bus, Mail, Lock, User as UserIcon, ArrowLeft, Eye, ShieldCheck, CheckCircle2 } from 'lucide-react';

type Tab = 'signin' | 'signup' | 'reset';

/**
 * Preview onboarding — a faithful WALKTHROUGH of the connected sign-in / create-account
 * flow so the founder can inspect the real onboarding UX in local preview. It is
 * intentionally inert: it performs no authentication, creates no account, and — most
 * importantly — never collects or persists a real password. The password field exists
 * only to show the UX; its value stays in local component state, is cleared on submit,
 * and is never written to storage or sent anywhere.
 */
export function PreviewOnboarding() {
  const [tab, setTab] = useState<Tab>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [outcome, setOutcome] = useState<string | null>(null);

  function simulate(e: React.FormEvent) {
    e.preventDefault();
    // Never authenticate or persist. Immediately discard the password.
    setPassword('');
    if (tab === 'signin') {
      setOutcome('In the connected app this would sign you in and load only the workspaces your account is assigned to.');
    } else if (tab === 'signup') {
      setOutcome('In the connected app this would create a PASSENGER account (no staff or admin role) and email a confirmation link. Staff access is granted separately by an administrator.');
    } else {
      setOutcome('In the connected app this would email a password-reset link, if the address has an account.');
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-8">
      <Link to="/account" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-forest-600">
        <ArrowLeft size={16} /> Back to account
      </Link>

      {/* Unmissable preview banner */}
      <div className="mb-4 flex items-start gap-2 rounded-xl bg-forest-900 px-3 py-2.5 text-[13px] text-lime-200">
        <Eye size={16} className="mt-0.5 shrink-0" />
        <span>
          <strong>Preview onboarding.</strong> This is a walkthrough of the real sign-up experience. It is
          <strong> not real account registration</strong> — no account is created, and nothing you type
          (including the password) is saved or sent.
        </span>
      </div>

      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-700 text-lime-300 shadow-raised">
          <Bus size={26} strokeWidth={2.5} />
        </span>
        <h1 className="text-2xl font-extrabold text-forest-900">To<span className="text-lime-500">Go</span></h1>
        <p className="text-sm text-forest-500">Your bus. Your stop. — Pilot sign in (preview).</p>
      </div>

      <div className="card p-5">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-sand-100 p-1">
          <button
            onClick={() => { setTab('signin'); setOutcome(null); }}
            className={`rounded-lg py-2 text-sm font-semibold ${tab !== 'signup' ? 'bg-white text-forest-800 shadow-card' : 'text-forest-500'}`}
          >
            Sign in
          </button>
          <button
            onClick={() => { setTab('signup'); setOutcome(null); }}
            className={`rounded-lg py-2 text-sm font-semibold ${tab === 'signup' ? 'bg-white text-forest-800 shadow-card' : 'text-forest-500'}`}
          >
            Create account
          </button>
        </div>

        {outcome && (
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-lime-50 px-3 py-2 text-sm text-forest-700 ring-1 ring-lime-200">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {outcome}
          </div>
        )}

        <form onSubmit={simulate} className="space-y-3">
          {tab === 'signup' && (
            <Field icon={<UserIcon size={16} />} label="Full name">
              <input className="input pl-10" value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder="Amina N." autoComplete="off" />
            </Field>
          )}
          <Field icon={<Mail size={16} />} label="Email">
            <input type="email" className="input pl-10" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="off" />
          </Field>
          {tab !== 'reset' && (
            <Field icon={<Lock size={16} />} label="Password (not saved in preview)">
              <input type="password" className="input pl-10" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="off" />
            </Field>
          )}

          <button type="submit" className="btn-primary w-full">
            {tab === 'signin' ? 'Preview sign in' : tab === 'signup' ? 'Preview create passenger account' : 'Preview reset link'}
          </button>
        </form>

        {tab === 'signin' && (
          <button onClick={() => { setTab('reset'); setOutcome(null); }}
            className="mt-3 w-full text-center text-sm font-medium text-forest-500">
            Forgot your password?
          </button>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-forest-50 px-3 py-2 text-xs text-forest-600 ring-1 ring-forest-100">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-forest-700" />
          <span>
            Public sign-up creates a <strong>passenger account only</strong> — never a staff or platform-admin
            role. Staff workspaces (driver, conductor, hub attendant, dispatcher) are granted separately by an
            administrator and resolved on the server from verified records.
          </span>
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] text-forest-400">
        Local preview · Illustrates the connected onboarding. No real accounts, passwords, or data.
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
