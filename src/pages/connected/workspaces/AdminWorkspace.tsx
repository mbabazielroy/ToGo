import { useState } from 'react';
import { Shield, CheckCircle2, Ban, RefreshCw, UserPlus } from 'lucide-react';
import { requireSupabase } from '../../../lib/supabase';
import { useToast } from '../../../components/ToastProvider';
import { useAsync, humanError } from '../hooks';
import { Loading, ErrorRow, StaffNote } from '../parts';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function AdminWorkspace() {
  const sb = requireSupabase();
  const toast = useToast();

  const hubs = useAsync(async () => {
    const { data, error } = await sb.from('hubs').select('*').order('city');
    if (error) throw error;
    return data as any[];
  }, []);
  const operators = useAsync(async () => {
    const { data, error } = await sb.from('operators').select('*').order('name');
    if (error) throw error;
    return data as any[];
  }, []);

  async function setApproval(hubId: string, status: string) {
    try {
      const { error } = await sb.from('hubs').update({
        approval_status: status,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
      }).eq('id', hubId);
      if (error) throw error;
      toast(`Hub ${status}.`, 'ok');
      hubs.reload();
    } catch (e) { toast(humanError(e), 'error'); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-forest-900"><Shield size={22} /> Platform admin</h1>
        <StaffNote>
          Administrators manage platform configuration and staff assignments. Public users can never
          promote themselves — these controls are enforced by database policies, not just the UI.
        </StaffNote>
      </div>

      {/* Hub approvals */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-forest-600">Hub approvals</h2>
          <button onClick={hubs.reload} className="text-forest-400"><RefreshCw size={15} /></button>
        </div>
        {hubs.loading && <Loading />}
        {hubs.error && <ErrorRow message={hubs.error} onRetry={hubs.reload} />}
        <div className="space-y-2">
          {(hubs.data ?? []).map((h) => (
            <div key={h.id} className="card flex items-center justify-between p-3.5">
              <div>
                <div className="font-semibold text-forest-900">{h.name} <span className="text-xs text-forest-400">· {h.city}</span></div>
                <div className="text-xs text-forest-500">
                  {h.approval_status}{h.is_demo ? ' · demo' : ''} · {h.is_active ? 'active' : 'inactive'}
                </div>
              </div>
              <div className="flex gap-1.5">
                {h.approval_status !== 'approved' && (
                  <button onClick={() => setApproval(h.id, 'approved')} className="btn-accent px-3 py-1.5 text-xs"><CheckCircle2 size={14} /> Approve</button>
                )}
                {h.approval_status === 'approved' && (
                  <button onClick={() => setApproval(h.id, 'suspended')} className="flex items-center gap-1 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600"><Ban size={14} /> Suspend</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Staff assignment */}
      <StaffAssignment operators={operators.data ?? []} hubs={hubs.data ?? []} />
    </div>
  );
}

function StaffAssignment({ operators, hubs }: { operators: any[]; hubs: any[] }) {
  const sb = requireSupabase();
  const toast = useToast();
  const [kind, setKind] = useState<'operator' | 'hub' | 'trip'>('operator');
  const [userId, setUserId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [tripId, setTripId] = useState('');
  const [busy, setBusy] = useState(false);

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim()) { toast('Enter a user id (UUID).', 'error'); return; }
    setBusy(true);
    try {
      if (kind === 'operator') {
        const { error } = await sb.from('operator_members').insert({ operator_id: targetId, user_id: userId.trim(), role: 'staff' });
        if (error) throw error;
      } else if (kind === 'hub') {
        const { error } = await sb.from('hub_staff').insert({ hub_id: targetId, user_id: userId.trim() });
        if (error) throw error;
      } else {
        const { error } = await sb.from('trip_staff').insert({ trip_id: tripId.trim(), user_id: userId.trim(), role: 'conductor' });
        if (error) throw error;
      }
      toast('Assignment created.', 'ok');
      setUserId('');
    } catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-forest-600"><UserPlus size={15} /> Assign staff</h2>
      <form onSubmit={assign} className="card space-y-3 p-4">
        <p className="text-xs text-forest-500">
          Assign a user (by their auth user id) to a workspace. Find user ids in the Supabase Auth dashboard.
          Passengers see no staff views until assigned here.
        </p>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-sand-100 p-1 text-sm font-semibold">
          {(['operator', 'hub', 'trip'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={`rounded-lg py-2 ${kind === k ? 'bg-white text-forest-800 shadow-card' : 'text-forest-500'}`}>
              {k === 'operator' ? 'Operator staff' : k === 'hub' ? 'Hub attendant' : 'Conductor'}
            </button>
          ))}
        </div>
        <label className="block"><span className="field-label">User id (UUID)</span>
          <input className="input font-mono" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="00000000-0000-…" /></label>
        {kind === 'operator' && (
          <label className="block"><span className="field-label">Operator</span>
            <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Select…</option>
              {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select></label>
        )}
        {kind === 'hub' && (
          <label className="block"><span className="field-label">Hub</span>
            <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Select…</option>
              {hubs.map((h) => <option key={h.id} value={h.id}>{h.name} — {h.city}</option>)}
            </select></label>
        )}
        {kind === 'trip' && (
          <label className="block"><span className="field-label">Trip id (UUID)</span>
            <input className="input font-mono" value={tripId} onChange={(e) => setTripId(e.target.value)} placeholder="trip uuid" /></label>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full">Create assignment</button>
      </form>
    </section>
  );
}
