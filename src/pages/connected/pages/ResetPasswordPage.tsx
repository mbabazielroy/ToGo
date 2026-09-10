import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, Loader2, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../auth/AuthProvider';
import { humanError } from '../hooks';

/**
 * New-password form reached from a password-recovery email link. Supabase's
 * detectSessionInUrl consumes the recovery token and fires PASSWORD_RECOVERY,
 * which AuthProvider surfaces as recoveryMode. If the link is expired/invalid,
 * there is no session and updateUser fails with a clear message.
 */
export function ResetPasswordPage() {
  const { session, updatePassword, clearRecoveryMode } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    setErr(null); setBusy(true);
    try {
      await updatePassword(pw);
      setDone(true);
      setTimeout(() => navigate('/', { replace: true }), 1200);
    } catch (e) {
      setErr(humanError(e));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-700 text-lime-300 shadow-raised"><Bus size={26} strokeWidth={2.5} /></span>
        <h1 className="text-2xl font-extrabold text-forest-900">Set a new password</h1>
      </div>
      <div className="card p-5">
        {!session && (
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> This reset link is invalid or has expired. Request a new one from the sign-in screen.
          </div>
        )}
        {err && <div className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {err}</div>}
        {done ? (
          <p className="text-center text-sm font-semibold text-forest-700">Password updated. Redirecting…</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block"><span className="field-label">New password</span>
              <span className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-forest-400"><Lock size={16} /></span>
                <input type="password" required minLength={6} className="input pl-10" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              </span>
            </label>
            <button type="submit" disabled={busy || !session} className="btn-primary w-full">{busy && <Loader2 size={16} className="animate-spin" />} Update password</button>
          </form>
        )}
        <button onClick={() => { clearRecoveryMode(); navigate('/', { replace: true }); }} className="mt-3 w-full text-center text-sm font-medium text-forest-500">Back to sign in</button>
      </div>
    </div>
  );
}
