import { useState } from 'react';
import { Shield, CheckCircle2, Ban, RefreshCw, UserPlus, Building2, MapPin } from 'lucide-react';
import { useToast } from '../../../components/ToastProvider';
import { useAsync, humanError } from '../hooks';
import { Loading, ErrorRow, StaffNote } from '../parts';
import { management } from '../../../data/management';

export function AdminWorkspace() {
  const toast = useToast();
  const operators = useAsync(() => management.listOperators(), []);
  const hubs = useAsync(() => management.listHubs(), []);

  const [opName, setOpName] = useState('');
  const [opSlug, setOpSlug] = useState('');
  const [hub, setHub] = useState({ name: '', city: 'Kampala', area: '' });

  async function run(fn: () => Promise<unknown>, ok: string, after?: () => void) {
    try { await fn(); toast(ok, 'ok'); after?.(); }
    catch (e) { toast(humanError(e), 'error'); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-forest-900"><Shield size={22} /> Platform admin</h1>
        <StaffNote>Admins manage platform configuration and staff assignments. Approval is an internal record of a real-world decision — it is not a claim of official authorization. Operators can never approve their own hubs or grant themselves platform rights (enforced by database policies).</StaffNote>
      </div>

      {/* Operators */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-forest-600"><Building2 size={15} /> Operators</h2>
          <button onClick={operators.reload} className="text-forest-400"><RefreshCw size={15} /></button>
        </div>
        {operators.loading && <Loading />}
        {operators.error && <ErrorRow message={operators.error} onRetry={operators.reload} />}
        <div className="space-y-2">
          {(operators.data ?? []).map((o) => (
            <div key={o.id} className="card flex items-center justify-between p-3.5">
              <div><div className="font-semibold text-forest-900">{o.name}</div><div className="text-xs text-forest-500">{o.slug} · {o.is_active ? 'active' : 'inactive'}</div></div>
              <button onClick={() => run(() => management.updateOperator(o.id, { is_active: !o.is_active }), 'Operator updated.', operators.reload)}
                className="btn-ghost px-3 py-1.5 text-xs">{o.is_active ? 'Deactivate' : 'Activate'}</button>
            </div>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); run(() => management.createOperator(opName, opSlug), 'Operator created.', () => { setOpName(''); setOpSlug(''); operators.reload(); }); }}
          className="card mt-2 grid grid-cols-[1fr_1fr_auto] gap-2 p-3">
          <input className="input" placeholder="Name" value={opName} onChange={(e) => setOpName(e.target.value)} />
          <input className="input" placeholder="slug" value={opSlug} onChange={(e) => setOpSlug(e.target.value)} />
          <button className="btn-primary px-3 py-2 text-sm">Add</button>
        </form>
      </section>

      {/* Hubs + approval */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-forest-600"><MapPin size={15} /> Hubs &amp; approval</h2>
          <button onClick={hubs.reload} className="text-forest-400"><RefreshCw size={15} /></button>
        </div>
        {hubs.loading && <Loading />}
        {hubs.error && <ErrorRow message={hubs.error} onRetry={hubs.reload} />}
        <div className="space-y-2">
          {(hubs.data ?? []).map((h) => (
            <div key={h.id} className="card flex items-center justify-between p-3.5">
              <div>
                <div className="font-semibold text-forest-900">{h.name} <span className="text-xs text-forest-400">· {h.city}</span></div>
                <div className="text-xs text-forest-500">{h.approval_status}{h.is_demo ? ' · demo' : ''} · {h.is_active ? 'active' : 'inactive'}</div>
              </div>
              <div className="flex gap-1.5">
                {h.approval_status !== 'approved'
                  ? <button onClick={() => run(() => management.setHubApproval(h.id, 'approved', 'Approved via admin console'), 'Hub approved.', hubs.reload)} className="btn-accent px-3 py-1.5 text-xs"><CheckCircle2 size={14} /> Approve</button>
                  : <button onClick={() => run(() => management.setHubApproval(h.id, 'suspended'), 'Hub suspended.', hubs.reload)} className="flex items-center gap-1 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600"><Ban size={14} /> Suspend</button>}
                <button onClick={() => run(() => management.updateHub(h.id, { is_active: !h.is_active }), 'Hub updated.', hubs.reload)} className="btn-ghost px-3 py-1.5 text-xs">{h.is_active ? 'Deactivate' : 'Activate'}</button>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); run(() => management.createHub(hub), 'Hub created (draft).', () => { setHub({ name: '', city: 'Kampala', area: '' }); hubs.reload(); }); }}
          className="card mt-2 grid grid-cols-[1fr_1fr_1fr_auto] gap-2 p-3">
          <input className="input" placeholder="Name" value={hub.name} onChange={(e) => setHub({ ...hub, name: e.target.value })} />
          <input className="input" placeholder="City" value={hub.city} onChange={(e) => setHub({ ...hub, city: e.target.value })} />
          <input className="input" placeholder="Area" value={hub.area} onChange={(e) => setHub({ ...hub, area: e.target.value })} />
          <button className="btn-primary px-3 py-2 text-sm">Add</button>
        </form>
      </section>

      {/* Staff assignment */}
      <StaffAssignment operators={operators.data ?? []} hubs={hubs.data ?? []} />
    </div>
  );
}

function StaffAssignment({ operators, hubs }: { operators: { id: string; name: string }[]; hubs: { id: string; name: string; city: string }[] }) {
  const toast = useToast();
  const [kind, setKind] = useState<'operator' | 'hub' | 'admin'>('operator');
  const [userId, setUserId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [busy, setBusy] = useState(false);

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim()) { toast('Enter a user id (UUID).', 'error'); return; }
    setBusy(true);
    try {
      if (kind === 'operator') await management.assignOperatorMember(targetId, userId.trim());
      else if (kind === 'hub') await management.assignHubStaff(targetId, userId.trim());
      else await management.setPlatformAdmin(userId.trim(), true);
      toast('Assignment saved.', 'ok'); setUserId('');
    } catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-forest-600"><UserPlus size={15} /> Assign staff</h2>
      <form onSubmit={assign} className="card space-y-3 p-4">
        <p className="text-xs text-forest-500">Assign a user (by auth user id, from the Supabase Auth dashboard) to a role. The first platform admin is created by the trusted SQL bootstrap; this promotes further admins.</p>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-sand-100 p-1 text-sm font-semibold">
          {(['operator', 'hub', 'admin'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-lg py-2 ${kind === k ? 'bg-white text-forest-800 shadow-card' : 'text-forest-500'}`}>
              {k === 'operator' ? 'Operator staff' : k === 'hub' ? 'Hub attendant' : 'Platform admin'}
            </button>
          ))}
        </div>
        <label className="block"><span className="field-label">User id (UUID)</span>
          <input className="input font-mono" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="00000000-0000-…" /></label>
        {kind === 'operator' && (
          <label className="block"><span className="field-label">Operator</span>
            <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}><option value="">Select…</option>{operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        )}
        {kind === 'hub' && (
          <label className="block"><span className="field-label">Hub</span>
            <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}><option value="">Select…</option>{hubs.map((h) => <option key={h.id} value={h.id}>{h.name} — {h.city}</option>)}</select></label>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full">Save assignment</button>
      </form>
    </section>
  );
}
