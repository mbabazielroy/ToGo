import { APP_MODE } from './lib/env';
import { StoreProvider } from './state/store';
import { SearchProvider } from './state/search';
import { ToastProvider } from './components/ToastProvider';
import { AuthProvider } from './auth/AuthProvider';
import { AdapterProvider } from './data/AdapterProvider';
import DemoApp from './App';
import { ConnectedApp } from './pages/connected/ConnectedApp';

/**
 * Chooses the app surface by mode:
 *  - demo      : the original local-only prototype (unchanged).
 *  - connected : real Supabase auth + shared data, workspaces by verified permission.
 * There is no silent fallback from connected to demo on auth/permission/network errors.
 */
export default function AppRoot() {
  if (APP_MODE === 'connected') {
    return (
      <ToastProvider>
        <AuthProvider>
          <AdapterProvider>
            <ConnectedApp />
          </AdapterProvider>
        </AuthProvider>
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
