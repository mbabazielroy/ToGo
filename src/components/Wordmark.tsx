import { Bus } from 'lucide-react';

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 select-none">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime-400 text-forest-900 shadow-sm">
        <Bus size={18} strokeWidth={2.5} />
      </span>
      <div className="leading-none">
        <span className="text-xl font-extrabold tracking-tight text-white">
          To<span className="text-lime-300">Go</span>
        </span>
        {!compact && (
          <span className="block text-[10px] font-medium uppercase tracking-widest text-forest-100/80">
            Your bus. Your stop.
          </span>
        )}
      </div>
    </div>
  );
}
