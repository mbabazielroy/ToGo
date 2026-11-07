// Smoke test for the website's routes under React Router: each page of the
// preview app renders the right screen without throwing. Server-side render, so it
// needs no browser.
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { StoreProvider } from './state/store';
import { SearchProvider } from './state/search';
import { ToastProvider } from './components/ToastProvider';
import DemoApp from './App';

function render(path: string): string {
  return renderToString(
    <StaticRouter location={path}>
      <StoreProvider>
        <SearchProvider>
          <ToastProvider>
            <DemoApp />
          </ToastProvider>
        </SearchProvider>
      </StoreProvider>
    </StaticRouter>,
  ).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

// Each path and a heading only that page shows.
const PAGES: [string, string][] = [
  ['/', 'Find your hub'],
  ['/hubs', 'Pickup hubs'],
  ['/search', 'Kampala → Mbarara'],
  ['/trips', 'My Trips'],
  ['/account', 'Demo profil'],
  ['/preview-onboarding', 'Back to account'],
  ['/staff/attendant', 'Hub attendant'],
  ['/staff/conductor', 'Conductor'],
  ['/staff/operator', 'Dispatcher console'],
];

describe('website routes', () => {
  for (const [path, heading] of PAGES) {
    it(`renders ${path}`, () => {
      expect(render(path)).toContain(heading);
    });
  }
});
