import type { ReactNode } from 'react';
import { Info } from 'lucide-react';

export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-lime-50 px-3 py-2 text-xs text-forest-700 ring-1 ring-lime-200">
      <Info size={14} className="mt-0.5 shrink-0 text-forest-500" />
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-forest-200 bg-white/60 px-6 py-10 text-center">
      {icon && <div className="text-forest-300">{icon}</div>}
      <p className="font-semibold text-forest-800">{title}</p>
      {children && <p className="max-w-xs text-sm text-forest-500">{children}</p>}
    </div>
  );
}

export function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between first:mt-0">
      <h2 className="text-sm font-bold uppercase tracking-wide text-forest-600">{title}</h2>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'warn' | 'accent';
}) {
  const tones = {
    default: 'bg-white text-forest-800',
    warn: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
    accent: 'bg-forest-700 text-white',
  } as const;
  return (
    <div className={`rounded-2xl p-3 shadow-card ${tones[tone]}`}>
      <div className="text-2xl font-extrabold leading-tight">{value}</div>
      <div
        className={`mt-0.5 text-[11px] font-medium uppercase tracking-wide ${
          tone === 'accent' ? 'text-forest-100/80' : 'opacity-70'
        }`}
      >
        {label}
      </div>
    </div>
  );
}

export function Toast({ message, tone }: { message: string; tone: 'ok' | 'error' }) {
  return (
    <div
      role="status"
      className={`fixed inset-x-0 bottom-24 z-40 mx-auto w-fit max-w-[90%] rounded-full px-4 py-2 text-sm font-semibold text-white shadow-raised ${
        tone === 'ok' ? 'bg-forest-700' : 'bg-red-600'
      }`}
    >
      {message}
    </div>
  );
}
