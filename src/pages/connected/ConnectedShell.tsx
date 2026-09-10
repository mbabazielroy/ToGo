import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bus, Home, Bell, UserCircle, ClipboardCheck, LayoutDashboard, Shield } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';

/** Shell for the connected app: header with staff workspace links (by verified
 *  permission) + a passenger bottom nav. Uses real routes so refresh, browser
 *  Back, and deep links all work. */
export function ConnectedShell({ children }: { children: ReactNode }) {
  const { profile, assignments, signOut } = useAuth();
  const location = useLocation();
  const onStaff = location.pathname.startsWith('/staff');

  const staffLinks = [
    { to: '/staff/attendant', label: 'Attendant', icon: ClipboardCheck, show: assignments.hubIds.length > 0 },
    { to: '/staff/conductor', label: 'Conductor', icon: Bus, show: assignments.conductorTripIds.length > 0 },
    { to: '/staff/operator', label: 'Operator', icon: LayoutDashboard, show: assignments.operatorIds.length > 0 },
    { to: '/staff/admin', label: 'Admin', icon: Shield, show: assignments.isAdmin },
  ].filter((l) => l.show);

  return (
    <div className="min-h-full bg-sand-100">
      <div className={`mx-auto flex min-h-full flex-col ${onStaff ? 'max-w-5xl' : 'max-w-md'}`}>
        <header className="sticky top-0 z-20 bg-forest-700 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <NavLink to="/" className="flex items-center gap-2 text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime-400 text-forest-900">
                <Bus size={18} strokeWidth={2.5} />
              </span>
              <span className="text-lg font-extrabold">To<span className="text-lime-300">Go</span></span>
              <span className="rounded-full bg-forest-800/70 px-2 py-0.5 text-[10px] font-semibold text-lime-200">
                Connected pilot
              </span>
            </NavLink>
            <button onClick={signOut}
              className="rounded-full bg-forest-800/60 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-forest-800">
              Sign out
            </button>
          </div>
          {staffLinks.length > 0 && (
            <div className="flex gap-1 overflow-x-auto px-3 pb-2">
              <WorkspaceLink to="/" label="Passenger" end />
              {staffLinks.map((l) => <WorkspaceLink key={l.to} to={l.to} label={l.label} />)}
            </div>
          )}
          <div className="bg-forest-900 px-4 py-1 text-center text-[11px] font-medium text-lime-200/90">
            Connected pilot · {profile?.full_name ?? 'Signed in'} · Illustrative service — not a real transport launch.
          </div>
        </header>

        <main className={`flex-1 px-4 pt-4 ${onStaff ? 'pb-10' : 'pb-28'}`} key={location.pathname}>
          {children}
        </main>

        {!onStaff && (
          <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-forest-100 bg-white/95 backdrop-blur">
            <ul className="flex items-stretch justify-around px-1 pt-1">
              <BottomItem to="/" label="Home" icon={Home} end />
              <BottomItem to="/notifications" label="Alerts" icon={Bell} />
              <BottomItem to="/account" label="Account" icon={UserCircle} />
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}

function WorkspaceLink({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) =>
        `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
          isActive ? 'bg-lime-400 text-forest-900' : 'bg-forest-800/50 text-forest-100'
        }`}>
      {label}
    </NavLink>
  );
}

function BottomItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof Home; end?: boolean }) {
  return (
    <li className="flex-1">
      <NavLink to={to} end={end}
        className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold ${
            isActive ? 'text-forest-700' : 'text-forest-400'
          }`}>
        {({ isActive }) => (
          <>
            <span className={`flex h-8 w-14 items-center justify-center rounded-full ${isActive ? 'bg-lime-200' : ''}`}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            </span>
            {label}
          </>
        )}
      </NavLink>
    </li>
  );
}
