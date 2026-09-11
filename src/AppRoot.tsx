import { useCallback, useEffect, useState } from 'react';
import { APP_MODE, isSupabaseConfigured } from './lib/env';
import { pingSupabase } from './lib/supabase';
import { StoreProvider } from './state/store';
import { SearchProvider } from './state/search';
import { ToastProvider } from './components/ToastProvider';
import { AuthProvider } from './auth/AuthProvider';
import { AdapterProvider } from './data/AdapterProvider';
import { SetupUnavailable } from './components/SetupUnavailable';
import DemoApp from './App';
import { ConnectedApp } from './pages/connected/ConnectedApp';

type ConnState = 'checking' | 'ready' | 'unreachable';

/** Verifies the backend is reachable before entering the connected app; on failure
 *  shows a retryable connection screen rather than a silent demo fallback. */
function ConnectionGate() {
  const [state, setState] = useState<ConnState>('checking');
  const [detail, setDetail] = useState<string | undefined>();
  const [retrying, setRetrying] = useState(false);

  const check = useCallback(async () => {
    setRetrying(true);
    const res = await pingSupabase();
    setRetrying(false);
    if (res.ok) setState('ready');
    else { setDetail(res.error); setState('unreachable'); }
  }, []);

  useEffect(() => { check(); }, [check]);

  if (state === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-forest-50">
        <div className="text-sm text-forest-600">Connecting…</div>
      </div>
    );
  }
  if (state === 'unreachable') {
    return <SetupUnavailable variant="unreachable" detail={detail} onRetry={check} retrying={retrying} />;
  }
  return (
    <AuthProvider>
      <AdapterProvider>
        <ConnectedApp />
      </AdapterProvider>
    </AuthProvider>
  );
}

/**
 * Chooses the app surface by mode:
 *  - connected : real Supabase auth + shared data (the normal entry point). When the
 *    backend is missing/unreachable it shows a setup/connection screen, never demo.
 *  - demo      : the original local-only prototype, opt-in via VITE_TOGO_DEMO only.
 */
export default function AppRoot() {
  if (APP_MODE === 'connected') {
    if (!isSupabaseConfigured) {
      return (
        <SetupUnavailable
          variant="unconfigured"
          onRetry={() => window.location.reload()}
        />
      );
    }
    return (
      <ToastProvider>
        <ConnectionGate />
      </ToastProvider>
    );
  }
  return (
    <StoreProvider>
      <SearchProvider>
        <ToastProvider>
          <DemoApp />
        </ToastProvider>
      </SearchProvider>
    </StoreProvider>
  );
}
