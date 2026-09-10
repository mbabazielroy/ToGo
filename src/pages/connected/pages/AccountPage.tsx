import { useState } from 'react';
import { UserCircle, Lock, LogOut, Loader2, Info } from 'lucide-react';
import { useAuth } from '../../../auth/AuthProvider';
import { useToast } from '../../../components/ToastProvider';
import { humanError } from '../hooks';

export function AccountPage() {
  const { profile, user, assignments, signOut, updatePassword } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) { toast('Password must be at least 6 characters.', 'error'); return; }
    setBusy(true);
    try { await updatePassword(pw); toast('Password updated.', 'ok'); setPw(''); }
    catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }

  const roles = [
    assignments.isAdmin && 'Platform admin',
    assignments.operatorIds.length && 'Operator staff',
    assignments.hubIds.length && 'Hub attendant',
    assignments.conductorTripIds.length && 'Conductor',
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-forest-900">Account</h1>

      <div className="card space-y-2 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-100 text-forest-700"><UserCircle size={26} /></span>
          <div>
            <div className="font-bold text-forest-900">{profile?.full_name ?? 'Traveller'}</div>
            <div className="text-xs text-forest-500">{user?.email}</div>
          </div>
        </div>
        <div className="text-xs text-forest-500">Role: Passenger{roles.length ? ` · ${roles.join(' · ')}` : ''}</div>
      </div>

      <form onSubmit={changePassword} className="card space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-forest-600"><Lock size={15} /> Change password</h2>
        <input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (min 6 chars)" autoComplete="new-password" />
        <button type="submit" disabled={busy} className="btn-primary w-full">{busy && <Loader2 size={16} className="animate-spin" />} Update password</button>
      </form>

      <div className="card flex items-start gap-2 p-4 text-sm text-forest-600">
        <Info size={16} className="mt-0.5 shrink-0 text-forest-400" />
        <span>Connected pilot. All operators, hubs, fares and tracking are illustrative — this is not a real transport service, and no payment is collected.</span>
      </div>

      <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded-xl border border-forest-200 bg-white py-3 text-sm font-semibold text-forest-700">
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );
}
