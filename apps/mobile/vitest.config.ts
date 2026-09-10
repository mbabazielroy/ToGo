/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Node-only tests for the mobile app: shared business rules + the injectable
// persistence sink used by the native (AsyncStorage) demo adapter. These do NOT
// import React Native modules, so they run in plain Node.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
