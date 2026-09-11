import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCircle, Bell, RotateCcw, Info, Github, Eye, ChevronRight } from 'lucide-react';
import { useStore } from '../../state/store';
import { useToast } from '../../components/ToastProvider';
import { DemoNote } from '../../components/ui';

export function Account() {
  const { state, updateProfile, resetDemo } = useStore();
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-forest-900">Account</h1>

      {/* Profile */}
      <div className="card space-y-3 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-100 text-forest-700">
            <UserCircle size={26} />
          </span>
          <div>
            <div className="font-bold text-forest-900">Demo profile</div>
            <div className="text-xs text-forest-500">Stored locally in this browser only.</div>
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="pname">Name</label>
          <input
            id="pname"
            className="input"
            value={state.profile.name}
            onChange={(e) => updateProfile({ name: e.target.value })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="pphone">Phone (demo)</label>
          <input
            id="pphone"
            className="input"
            value={state.profile.phone}
            onChange={(e) => updateProfile({ phone: e.target.value })}
            placeholder="+256 7xx xxx xxx"
            inputMode="tel"
          />
        </div>
      </div>

      {/* Preview sign-up experience */}
      <Link
        to="/preview-onboarding"
        className="card flex items-center gap-3 p-4 transition hover:bg-forest-50"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-100 text-forest-700">
          <Eye size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-forest-900">Preview sign-up experience</div>
          <div className="text-xs text-forest-500">
            Inspect the connected onboarding (create account, sign in, reset). Local preview only — no real
            registration, and no password is saved.
          </div>
        </div>
        <ChevronRight size={18} className="shrink-0 text-forest-300" />
      </Link>

      {/* Notifications */}
      <div className="card p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-forest-600">
          <Bell size={15} /> Notifications
        </h2>
        <div className="divide-y divide-forest-50">
          <ToggleRow
            label="Boarding reminders"
            desc="Remind me when it’s time to head to my hub."
            value={state.profile.notifyBoarding}
            onChange={(v) => updateProfile({ notifyBoarding: v })}
          />
          <ToggleRow
            label="Delay alerts"
            desc="Tell me if my bus is running late."
            value={state.profile.notifyDelays}
            onChange={(v) => updateProfile({ notifyDelays: v })}
          />
        </div>
        <DemoNote>
          Preferences are illustrative — ToGo does not send real SMS or push notifications in this demo.
        </DemoNote>
      </div>

      {/* About */}
      <div className="card space-y-2 p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-forest-600">
          <Info size={15} /> About this prototype
        </h2>
        <p className="text-sm text-forest-600">
          ToGo is a virtual bus terminal concept for Uganda, founded by Elroy and Millie. This
          prototype demonstrates the coordinated pickup-hub experience for the Kampala ⇄ Mbarara
          corridor.
        </p>
        <p className="text-sm text-forest-600">
          All operators, hubs, fares, schedules, payments and tracking are illustrative. Nothing here
          implies a real partnership, approval, booking or pickup guarantee. Demo data lives only in
          this browser and is not shared between devices.
        </p>
        <a
          href="https://github.com"
          onClick={(e) => e.preventDefault()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest-500"
        >
          <Github size={13} /> Prototype source (demo)
        </a>
      </div>

      {/* Reset */}
      <div className="card p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-forest-600">
          <RotateCcw size={15} /> Reset demo
        </h2>
        <p className="mb-3 text-sm text-forest-600">
          Restore fresh seed data — clears all bookings, check-ins and trip changes on this device.
        </p>
        {confirmReset ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-forest-800">
              This will erase all demo bookings and activity. Continue?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmReset(false)} className="btn-ghost flex-1">
                Keep data
              </button>
              <button
                onClick={() => {
                  resetDemo();
                  setConfirmReset(false);
                  toast('Demo reset to seed data.', 'ok');
                }}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white active:scale-[0.98]"
              >
                Reset everything
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} className="btn-ghost w-full">
            <RotateCcw size={16} /> Reset demo data
          </button>
        )}
      </div>

      <p className="pb-2 text-center text-[11px] text-forest-400">ToGo · Your bus. Your stop. · Demo build</p>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div>
        <div className="text-sm font-semibold text-forest-900">{label}</div>
        <div className="text-xs text-forest-500">{desc}</div>
      </div>
      <button
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          value ? 'bg-forest-600' : 'bg-forest-200'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
            value ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}
