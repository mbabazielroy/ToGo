import { Loader2, AlertCircle } from 'lucide-react';

export function Loading() {
  return <div className="flex justify-center py-6 text-forest-400"><Loader2 className="animate-spin" /></div>;
}

export function ErrorRow({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
      <span className="flex items-center gap-1.5"><AlertCircle size={14} /> {message}</span>
      {onRetry && <button onClick={onRetry} className="font-semibold underline">Retry</button>}
    </div>
  );
}

export function StaffNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-forest-50 px-3 py-2 text-xs text-forest-600 ring-1 ring-forest-100">
      {children}
    </div>
  );
}
