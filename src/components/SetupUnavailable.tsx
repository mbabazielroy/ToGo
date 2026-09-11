import { AlertTriangle, CloudOff, RefreshCw } from 'lucide-react';

/**
 * Shown when connected mode is intended but the backend is missing or unavailable.
 * The app never silently falls back to demo mode — this is the honest failure UX.
 */
export function SetupUnavailable({
  variant, detail, onRetry, retrying,
}: { variant: 'unconfigured' | 'unreachable'; detail?: string; onRetry: () => void; retrying?: boolean }) {
  const unconfigured = variant === 'unconfigured';
  return (
    <div className="flex min-h-screen items-center justify-center bg-forest-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-forest-100">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-forest-50">
          {unconfigured ? <AlertTriangle className="text-forest-700" /> : <CloudOff className="text-forest-700" />}
        </div>
        <h1 className="text-xl font-extrabold text-forest-900">
          {unconfigured ? 'Setup needed' : 'Can’t reach ToGo'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-forest-600">
          {unconfigured
            ? 'ToGo isn’t connected to its booking service yet. The site needs a Supabase project URL and publishable key configured at build time before real data can load.'
            : 'ToGo is configured but the booking service didn’t respond. Check your connection and try again — your data is safe on the server.'}
        </p>
        {detail ? <p className="mt-2 text-xs text-forest-400">{detail}</p> : null}
        <button
          onClick={onRetry}
          disabled={retrying}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-forest-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} /> {retrying ? 'Checking…' : 'Try again'}
        </button>
        {unconfigured && (
          <p className="mt-3 text-xs text-forest-400">
            Configuration is read at build time — after adding it, rebuild or restart the app.
          </p>
        )}
      </div>
    </div>
  );
}
