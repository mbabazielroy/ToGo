/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Two pages: the public info site (index.html) and the operations console
// (console/index.html, served at /console). EXPO_PUBLIC_* values are shared with
// the phone apps and the legal pages (support email, legal name, store links);
// all of them are public by design.
export default defineConfig({
  plugins: [react()],
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
