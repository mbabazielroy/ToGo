import { ShieldAlert } from 'lucide-react';

export function StaffIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold text-forest-900">{title}</h1>
      <p className="text-sm text-forest-500">{subtitle}</p>
      <div className="flex items-start gap-2 rounded-xl bg-forest-50 px-3 py-2 text-xs text-forest-600 ring-1 ring-forest-100">
        <ShieldAlert size={14} className="mt-0.5 shrink-0" />
        <span>
          Demo staff view — shares the same local state as the passenger app. This is not real
          authentication or access control.
        </span>
      </div>
    </div>
  );
}
