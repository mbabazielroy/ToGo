import { defineConfig, devices } from '@playwright/test';

// End-to-end tests that drive the real app screens, running the web build of each
// app in preview (demo) mode: the same React Native screens, rendered in a phone-
// sized browser. Build first with `npm run e2e:build`, then `npm run e2e`.
// Native-only parts (camera, push, keychain, maps SDK) aren't covered here.
export default defineConfig({
  testDir: './e2e',
  // macOS writes ._ copies of files on non-Apple drives; never load them.
  testIgnore: /(^|[\\/])\._/,
  outputDir: './e2e/results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { outputFolder: 'e2e/report', open: 'never' }]] : 'list',
  use: { ...devices['iPhone 13'], browserName: 'chromium', trace: 'retain-on-failure' },
  projects: [
    { name: 'passenger', testMatch: /passenger\.spec\.ts/, use: { baseURL: 'http://localhost:4310' } },
    { name: 'staff', testMatch: /staff\.spec\.ts/, use: { baseURL: 'http://localhost:4311' } },
    { name: 'journey', testMatch: /journey\.spec\.ts/, use: { baseURL: 'http://localhost:4312' } },
  ],
  webServer: [
    { command: 'node e2e/serve.mjs dist-e2e/passenger 4310', url: 'http://localhost:4310', reuseExistingServer: !process.env.CI },
    { command: 'node e2e/serve.mjs dist-e2e/staff 4311', url: 'http://localhost:4311', reuseExistingServer: !process.env.CI },
    { command: 'node e2e/serve.mjs dist-e2e/combined 4312', url: 'http://localhost:4312', reuseExistingServer: !process.env.CI },
  ],
});
