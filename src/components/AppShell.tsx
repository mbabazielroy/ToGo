import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useStore } from '../state/store';
import { Wordmark } from './Wordmark';
import { RoleSwitcher } from './RoleSwitcher';
import { BottomNav } from './BottomNav';

/** Persistent, unobtrusive demo label. */
function DemoRibbon() {
  return (
    <div className="bg-forest-900 px-4 py-1 text-center text-[11px] font-medium text-lime-200/90">
      Demo mode · Operators, hubs, fares & tracking are illustrative — no real bookings or pickups.
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const location = useLocation();
  const isPassenger = state.role === 'passenger';
  const isStaff = !isPassenger;

  return (
    <div className="min-h-full bg-sand-100">
      <div className={`mx-auto flex min-h-full flex-col ${isStaff ? 'max-w-5xl' : 'max-w-md'}`}>
        <header className="sticky top-0 z-20 bg-forest-700 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <Link to={isPassenger ? '/' : `/staff/${state.role}`} aria-label="ToGo home">
              <Wordmark />
            </Link>
            <RoleSwitcher />
          </div>
          <DemoRibbon />
        </header>

        <main
          className={`flex-1 px-4 pt-4 ${isPassenger ? 'pb-28' : 'pb-10'}`}
          key={location.pathname}
        >
          {children}
        </main>

        {isPassenger && <BottomNav />}
      </div>
    </div>
  );
}
