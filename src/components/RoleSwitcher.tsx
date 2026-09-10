import { useState } from 'react';
import { ChevronDown, User, ClipboardCheck, Bus, LayoutDashboard, Info } from 'lucide-react';
import { useStore } from '../state/store';
import { useNavigate } from 'react-router-dom';
import type { DemoRole } from '../types';

const ROLES: { role: DemoRole; label: string; icon: typeof User; path: string }[] = [
  { role: 'passenger', label: 'Passenger', icon: User, path: '/' },
  { role: 'attendant', label: 'Hub attendant', icon: ClipboardCheck, path: '/staff/attendant' },
  { role: 'conductor', label: 'Conductor', icon: Bus, path: '/staff/conductor' },
  { role: 'operator', label: 'Operator', icon: LayoutDashboard, path: '/staff/operator' },
];

export function RoleSwitcher() {
  const { state, setRole } = useStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const current = ROLES.find((r) => r.role === state.role) ?? ROLES[0];

  function choose(r: (typeof ROLES)[number]) {
    setRole(r.role);
    setOpen(false);
    navigate(r.path);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full bg-forest-800/60 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-forest-800"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <current.icon size={15} />
        <span className="hidden xs:inline">{current.label}</span>
        <span className="xs:hidden">Role</span>
        <ChevronDown size={14} className={open ? 'rotate-180 transition' : 'transition'} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl bg-white p-1.5 shadow-raised ring-1 ring-black/5"
          >
            <div className="flex items-start gap-2 px-3 py-2 text-xs text-forest-600">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>Switches demo views only — this is not real authentication or access control.</span>
            </div>
            {ROLES.map((r) => (
              <button
                key={r.role}
                role="menuitem"
                onClick={() => choose(r)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                  r.role === state.role
                    ? 'bg-forest-700 text-white'
                    : 'text-forest-800 hover:bg-forest-50'
                }`}
              >
                <r.icon size={16} />
                {r.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
