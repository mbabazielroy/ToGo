import { test, expect } from '@playwright/test';
import { morning, shown } from './helpers';

// The whole trip across both sides, in the combined preview build (one device):
// a passenger reserves and checks in, then the conductor boards them with the
// code from their boarding pass.

test('passenger reserves and checks in; conductor boards them by code', async ({ page }) => {
  await morning(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/');

  await page.getByRole('button', { name: /Get started/ }).first().click();
  await page.getByLabel('Your name, optional').fill('Ruth Journey');
  await page.getByRole('button', { name: /Start travelling/ }).click();
  await page.getByRole('button', { name: /^Savannah Coaches, pickup 07:00/ }).click();
  await page.getByRole('button', { name: 'Confirm reservation' }).click();
  await expect(shown(page.getByText('Boarding pass'))).toBeVisible();

  // The short boarding code printed under the QR.
  const line = await shown(page.getByText(/Boarding code/)).innerText();
  const code = line.match(/Boarding code\s+(\w+)/)?.[1];
  expect(code, 'boarding code on the pass').toBeTruthy();
  await page.getByRole('button', { name: 'Check in' }).click();
  await expect(shown(page.getByText(/You.re checked in/))).toBeVisible();

  // Same phone, crew side: the conductor of that bus.
  await page.goto('/staff-signin');
  await page.getByText('Grace Nakato', { exact: true }).click();
  await expect(shown(page.getByText('Ruth Journey'))).toBeVisible();
  await page.getByLabel('Boarding code').fill(code!);
  await page.getByRole('button', { name: 'Find' }).click();
  await page.getByRole('button', { name: /Board 1/ }).click();
  await expect(shown(page.getByText('Ruth Journey boarded · 1 seat'))).toBeVisible();
});
