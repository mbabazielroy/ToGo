import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router';
import { Loader2, LayoutDashboard, Shield } from 'lucide-react';
import { isSupabaseConfigured } from './lib/env';
import { pingSupabase } from './lib/supabase';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AdapterProvider } from './data/AdapterProvider';
import { ToastProvider } from './components/ToastProvider';
import { SetupUnavailable } from './components/SetupUnavailable';
import { AuthScreen } from './AuthScreen';
import { ResetPasswordPage } from './ResetPasswordPage';
import { useIdleSignOut, IDLE_NOTICE_KEY } from './auth/idle';
import { OperatorWorkspace } from './OperatorWorkspace';
import { AdminWorkspace } from './AdminWorkspace';

/**
 * The operations console, served at /console. Operators manage their fleet,
 * routes, departures, crews and incidents; platform admins manage operators,
 * hubs and staff access. Passengers and crews use the phone apps instead.
 * Every action is checked by the database's access rules, not just this page.
 */
export function ConsoleApp() {
  if (!isSupabaseConfigured) {
    return <SetupUnavailable variant="unconfigured" onRetry={() => window.location.reload()} />;
  }
  return (
    <ToastProvider>
      <ConnectionGate />
    </ToastProvider>
  );
}

function ConnectionGate() {
  const [state, setState] = useState<'checking' | 'ready' | 'unreachable'>('checking');
  const [detail, setDetail] = useState<string | undefined>();
  const [retrying, setRetrying] = useState(false);
  const check = useCallback(async () => {
    setRetrying(true);
    const res = await pingSupabase();
    setRetrying(false);
    if (res.ok) setState('ready');
    else { setDetail(res.error); setState('unreachable'); }
  }, []);
  useEffect(() => { check(); }, [check]);

  if (state === 'checking') return <Centered><Loader2 className="animate-spin" /></Centered>;
  if (state === 'unreachable') return <SetupUnavailable variant="unreachable" detail={detail} onRetry={check} retrying={retrying} />;
  return (
    <AuthProvider>
      <AdapterProvider>
        <Console />
      </AdapterProvider>
    </AuthProvider>
  );
}

function Console() {
  const { loading, session, recoveryMode, assignments, signOut } = useAuth();
  const onIdle = useCallback(() => {
    try { sessionStorage.setItem(IDLE_NOTICE_KEY, '1'); } catch { /* notice is optional */ }
    void signOut();
  }, [signOut]);
  useIdleSignOut(!!session && !recoveryMode, onIdle);
  if (loading) return <Centered><Loader2 className="animate-spin" /></Centered>;
  // A password-recovery link takes precedence over everything else.
  if (recoveryMode) return <ResetPasswordPage />;
  if (!session) {
    return (
      <Routes>
        <Route path="/auth/reset" element={<ResetPasswordPage />} />
        <Route path="*" element={<AuthScreen />} />
      </Routes>
    );
  }

  const canOperate = assignments.operatorIds.length > 0;
  const home = assignments.isAdmin ? '/admin' : canOperate ? '/operator' : null;
  return (
    <Shell>
      <Routes>
        <Route path="/operator" element={canOperate ? <OperatorWorkspace operatorIds={assignments.operatorIds} /> : <Navigate to="/" replace />} />
        <Route path="/admin" element={assignments.isAdmin ? <AdminWorkspace /> : <Navigate to="/" replace />} />
        <Route path="/auth/reset" element={<ResetPasswordPage />} />
        <Route path="*" element={home ? <Navigate to={home} replace /> : <NoAccess />} />
      </Routes>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { profile, assignments, signOut } = useAuth();
  const links = [
    { to: '/operator', label: 'Operator', icon: LayoutDashboard, show: assignments.operatorIds.length > 0 },
    { to: '/admin', label: 'Admin', icon: Shield, show: assignments.isAdmin },
  ].filter((l) => l.show);
  return (
    <div className="min-h-full bg-sand-100">
      <header className="sticky top-0 z-20 bg-forest-800 text-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <img src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
          <span className="text-lg font-extrabold">ToGo <span className="font-semibold text-lime-300">operations</span></span>
          <nav className="ml-4 flex gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to}
                className={({ isActive }) => `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-lime-400 text-forest-900' : 'text-forest-100 hover:bg-forest-700'}`}>
                <l.icon size={15} /> {l.label}
              </NavLink>
            ))}
          </nav>
          <span className="ml-auto hidden text-sm text-forest-100 sm:inline">{profile?.full_name}</span>
          <button onClick={signOut} className="rounded-full bg-forest-900/60 px-3 py-1.5 text-sm font-semibold ring-1 ring-white/15 hover:bg-forest-900">
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-12 pt-5">{children}</main>
    </div>
  );
}

function NoAccess() {
  return (
    <div className="card mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-extrabold text-forest-900">No operations access</h1>
      <p className="mt-2 text-sm text-forest-600">
        This console is for bus operators and ToGo administrators. If you should have
        access, ask an administrator to add your account. Passengers use the ToGo app;
        drivers, conductors and hub attendants use ToGo Staff.
      </p>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center text-forest-500">{children}</div>;
}
