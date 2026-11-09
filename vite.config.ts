/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Two pages: the public info site (index.html) and the operations console
// (console/index.html, served at /console). EXPO_PUBLIC_* values are shared with
// the phone apps and the legal pages (support email, legal name, store links);
// all of them are public by design.
// Serve the console's own routes the way deploy/nginx.conf does, so local
// development and `vite preview` match production: /console → /console/, and
// /console/anything-without-a-file-extension → the console page.
function consoleRoutes(): Plugin {
  const route: Connect.NextHandleFunction = (req, res, next) => {
    const path = (req.url ?? '').split('?')[0];
    if (path === '/console') {
      res.statusCode = 301;
      res.setHeader('Location', '/console/' + (req.url!.includes('?') ? req.url!.slice(req.url!.indexOf('?')) : ''));
      res.end();
      return;
    }
    if (path.startsWith('/console/') && path !== '/console/' && !/\.[a-z0-9]+$/i.test(path)) req.url = '/console/index.html';
    next();
  };
  return {
    name: 'togo-console-routes',
    configureServer: (server) => { server.middlewares.use(route); },
    configurePreviewServer: (server) => { server.middlewares.use(route); },
  };
}

export default defineConfig({
  plugins: [react(), consoleRoutes()],
  envPrefix: ['VITE_', 'EXPO_PUBLIC_'],
  build: {
    rollupOptions: {
      input: {
        site: resolve(__dirname, 'index.html'),
        console: resolve(__dirname, 'console/index.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'supabase/functions/**/*.test.ts'],
    // macOS writes ._ copies of every file on non-Apple drives; never run them.
    exclude: ['**/node_modules/**', '**/._*'],
  },
});
