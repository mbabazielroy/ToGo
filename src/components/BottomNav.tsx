import { NavLink } from 'react-router-dom';
import { Home, MapPin, Ticket, UserCircle } from 'lucide-react';

const ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/hubs', label: 'Hubs', icon: MapPin, end: false },
  { to: '/trips', label: 'My Trips', icon: Ticket, end: false },
  { to: '/account', label: 'Account', icon: UserCircle, end: false },
];

export function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-forest-100 bg-white/95 backdrop-blur">
      <ul className="flex items-stretch justify-around px-1 pt-1">
        {ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition ${
                  isActive ? 'text-forest-700' : 'text-forest-400 hover:text-forest-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition ${
                      isActive ? 'bg-lime-200' : 'bg-transparent'
                    }`}
                  >
                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
