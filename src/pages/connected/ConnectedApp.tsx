import { useState } from 'react';
import { Loader2, LogOut, User, ClipboardCheck, Bus, LayoutDashboard, Shield } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { AuthScreen } from './AuthScreen';
import { PassengerWorkspace } from './workspaces/PassengerWorkspace';
import { ConductorWorkspace } from './workspaces/ConductorWorkspace';
import { AttendantWorkspace } from './workspaces/AttendantWorkspace';
import { OperatorWorkspace } from './workspaces/OperatorWorkspace';
import { AdminWorkspace } from './workspaces/AdminWorkspace';

type WorkspaceKey = 'passenger' | 'attendant' | 'conductor' | 'operator' | 'admin';

const WS_META: Record<WorkspaceKey, { label: string; icon: typeof User }> = {
  passenger: { label: 'Passenger', icon: User },
  attendant: { label: 'Hub attendant', icon: ClipboardCheck },
  conductor: { label: 'Conductor', icon: Bus },
  operator: { label: 'Operator', icon: LayoutDashboard },
  admin: { label: 'Admin', icon: Shield },
};

export function ConnectedApp() {
  const { loading, session, profile, assignments, signOut } = useAuth();
  const [ws, setWs] = useState<WorkspaceKey>('passenger');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-forest-500">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!session) return <AuthScreen />;

  // Verified permissions decide which workspaces exist — no role switcher here.
  const available: WorkspaceKey[] = ['passenger'];
  if (assignments.hubIds.length) available.push('attendant');
  if (assignments.conductorTripIds.length) available.push('conductor');
  if (assignments.operatorIds.length) available.push('operator');
  if (assignments.isAdmin) available.push('admin');
  const active = available.includes(ws) ? ws : 'passenger';

  return (
    <div className="min-h-full bg-sand-100">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col">
        <header className="sticky top-0 z-20 bg-forest-700 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime-400 text-forest-900">
                <Bus size={18} strokeWidth={2.5} />
              </span>
              <div className="leading-none">
                <span className="text-lg font-extrabold">To<span className="text-lime-300">Go</span></span>
                <span className="ml-2 rounded-full bg-forest-800/70 px-2 py-0.5 text-[10px] font-semibold text-lime-200">
                  Connected pilot
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-forest-100/80 sm:inline">{profile?.full_name}</span>
              <button onClick={signOut} className="flex items-center gap-1.5 rounded-full bg-forest-800/60 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-forest-800">
                <LogOut size={14} /> Sign out
              </button>
            </div>
          </div>
          {available.length > 1 && (
            <div className="flex gap-1 overflow-x-auto px-3 pb-2">
              {available.map((k) => {
                const M = WS_META[k];
                return (
                  <button key={k} onClick={() => setWs(k)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                      active === k ? 'bg-lime-400 text-forest-900' : 'bg-forest-800/50 text-forest-100'
                    }`}>
                    <M.icon size={14} /> {M.label}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        <main className="flex-1 px-4 py-4">
          {active === 'passenger' && <PassengerWorkspace />}
          {active === 'attendant' && <AttendantWorkspace hubIds={assignments.hubIds} />}
          {active === 'conductor' && <ConductorWorkspace tripIds={assignments.conductorTripIds} />}
          {active === 'operator' && <OperatorWorkspace operatorIds={assignments.operatorIds} />}
          {active === 'admin' && <AdminWorkspace />}
        </main>
      </div>
    </div>
  );
}
