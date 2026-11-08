import { test, expect } from '@playwright/test';
import { morning, shown } from './helpers';

// ToGo Staff, preview mode: each crew workspace opens from sign-in and its main
// actions work. (Preview personas stand in for real staff accounts.)

test.beforeEach(async ({ page }) => {
  await morning(page);
  page.on('dialog', (d) => d.accept()); // "Start trip?" and similar confirmations
  await page.goto('/');
  await expect(shown(page.getByText('Sign in to your shift'))).toBeVisible();
});

test('a driver starts the trip and marks hubs reached', async ({ page }) => {
  await page.getByText('Moses Okello', { exact: true }).click();
  await expect(shown(page.getByText('First pickup', { exact: false }))).toBeVisible();
  // Button names start with an icon glyph, so match the words only.
  await page.getByRole('button', { name: /Start trip/ }).click();
  await expect(shown(page.getByText('Trip started.'))).toBeVisible();
  // The trip starts at the first hub; the next button is the second hub.
  await page.getByRole('button', { name: /Arrived at Ndeeba Roadside Point/ }).click();
  await expect(shown(page.getByText('Arrived at Ndeeba Roadside Point.'))).toBeVisible();
  await expect(page.getByRole('button', { name: /Arrived at Natete Junction Stop/ })).toBeVisible();
});

test('a conductor sees the manifest and an unknown code is refused', async ({ page }) => {
  await page.getByText('Grace Nakato', { exact: true }).click();
  await expect(shown(page.getByText('Scan boarding pass'))).toBeVisible();
  await page.getByLabel('Boarding code').fill('9999');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(shown(page.getByText('That boarding code was not recognised.'))).toBeVisible();
});

test('a hub attendant sees the buses due at their hub', async ({ page }) => {
  await page.getByText('Peter Ssemanda', { exact: true }).click();
  await expect(shown(page.getByText('Buses at this hub', { exact: false }))).toBeVisible();
  await expect(shown(page.getByText('Savannah Coaches · in 1 h 30 min'))).toBeVisible();
});

test('operations sees the day and the departures that need crew', async ({ page }) => {
  await page.getByText('Operations team', { exact: true }).click();
  await expect(shown(page.getByText(/Needs crew · 2/i))).toBeVisible();
  await page.getByRole('tab', { name: /Departures/ }).or(page.getByText('Departures', { exact: true }).last()).first().click();
  await expect(shown(page.getByText(/Departures/))).toBeVisible();
});

test('the staff app has no passenger booking screens', async ({ page }) => {
  await page.goto('/home');
  await expect(shown(page.getByText('Sign in to your shift').or(page.getByText(/This screen doesn.t exist|Unmatched Route/i)))).toBeVisible();
});
