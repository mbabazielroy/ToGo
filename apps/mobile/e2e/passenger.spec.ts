import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { morning, shown } from './helpers';

/** Onboard and reserve one seat on the 07:00 bus from Nakawa Green Hub. */
async function reserveNakawaSeat(page: Page) {
  await page.getByRole('button', { name: /Get started/ }).first().click();
  await page.getByLabel('Your name, optional').fill('Amina Test');
  await page.getByRole('button', { name: /Start travelling/ }).click();
  await page.getByRole('button', { name: /^Savannah Coaches, pickup 07:00/ }).click();
  await page.getByRole('button', { name: 'Confirm reservation' }).click();
  await expect(shown(page.getByText('Boarding pass'))).toBeVisible();
}

// ToGo (passenger app), preview mode: first launch → onboarding → reserve a seat →
// boarding pass → check in → My trips → cancel.

test.beforeEach(async ({ page }) => { await morning(page); });

test('a new passenger reserves a seat, checks in and sees the pass', async ({ page }) => {
  await page.goto('/');

  // Welcome: intro slides with Get started.
  await expect(shown(page.getByText('Your seat, reserved in seconds'))).toBeVisible();
  await page.getByRole('button', { name: /Get started/ }).first().click();

  // Onboarding: everything optional.
  await page.getByLabel('Your name, optional').fill('Amina Test');
  await page.getByRole('button', { name: /Start travelling/ }).click();

  // Home: today's departures.
  await expect(shown(page.getByText(/still to come/))).toBeVisible();
  await page.getByRole('button', { name: /^Savannah Coaches, pickup 07:00/ }).click();

  // Review and reserve.
  await expect(shown(page.getByText('Review trip'))).toBeVisible();
  await expect(page.getByLabel('Lead passenger name')).toHaveValue('Amina Test');
  await page.getByRole('button', { name: /More passengers/ }).click();
  await page.getByRole('button', { name: 'Confirm reservation' }).click();

  // Boarding pass.
  await expect(shown(page.getByText('Boarding pass'))).toBeVisible();
  await expect(page.getByLabel('Boarding QR code')).toBeVisible();
  await expect(shown(page.getByText('2 passengers'))).toBeVisible();
  await expect(shown(page.getByText('Mbarara'))).toBeVisible();

  // Check-in is open (pickup 07:00, now 05:30).
  await page.getByRole('button', { name: 'Check in' }).click();
  await expect(shown(page.getByText(/You.re checked in/))).toBeVisible();

  // My trips lists it as upcoming.
  await page.getByRole('button', { name: /back/i }).first().click();
  await expect(shown(page.getByText(/Upcoming · 1/))).toBeVisible();
});

test('a passenger can cancel a reservation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Get started/ }).first().click();
  await page.getByRole('button', { name: /Start travelling/ }).click();
  await page.getByRole('button', { name: /^Pearl Express, pickup 10:30/ }).click();
  await page.getByLabel('Lead passenger name').fill('Cancel Test');
  await page.getByRole('button', { name: 'Confirm reservation' }).click();
  await expect(shown(page.getByText('Boarding pass'))).toBeVisible();

  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Cancel reservation' }).click();
  // The app's confirm dialog (web: an in-page sheet or the browser's confirm).
  const confirm = page.getByRole('button', { name: 'Cancel reservation' }).last();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect(shown(page.getByText('This reservation was cancelled and the seats released.'))).toBeVisible();
});

test('returning passengers get a welcome back screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Get started/ }).first().click();
  await page.getByLabel('Your name, optional').fill('Joseph Okello');
  await page.getByRole('button', { name: /Start travelling/ }).click();
  await expect(shown(page.getByText(/still to come/))).toBeVisible();

  // Signing out in preview mode returns to the welcome screen.
  await page.goto('/welcome');
  await expect(shown(page.getByText('Welcome back, Joseph'))).toBeVisible();
  await page.getByRole('button', { name: 'Continue as Joseph' }).click();
  await expect(shown(page.getByText(/still to come/))).toBeVisible();
});

test('the pass shows how far the passenger is from their hub, and follows them', async ({ page, context }) => {
  // Location already allowed, standing about 700 m north of Nakawa Green Hub.
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 0.335, longitude: 32.615 });

  await page.goto('/');
  await reserveNakawaSeat(page);

  // No question asked: location was already allowed, so the distance just appears.
  const distance = shown(page.getByText(/^You’re (\d+ m|[\d.]+ km) from /));
  await expect(distance).toBeVisible();
  const before = await distance.textContent();

  // They walk: the distance updates without touching anything.
  await context.setGeolocation({ latitude: 0.36, longitude: 32.615 });
  await expect.poll(async () => shown(page.getByText(/^You’re (\d+ m|[\d.]+ km) from /)).textContent()).not.toBe(before);
});

test('without location allowed, the pass offers a button instead of asking', async ({ page }) => {
  await page.goto('/');
  await reserveNakawaSeat(page);
  await expect(shown(page.getByRole('button', { name: /Show how far I am from/ }))).toBeVisible();
});

test('the sign-in screen checks new passwords as they’re typed and offers a reset code', async ({ page }) => {
  await page.goto('/auth');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Email').fill('amina@example.com');
  const password = page.getByLabel('Password', { exact: true });

  // Common and personal passwords are refused, with the reason shown.
  await password.fill('Password123');
  await expect(shown(page.getByText(/too common/))).toBeVisible();
  await password.fill('amina2026!!');
  await expect(shown(page.getByText(/email address in your password/))).toBeVisible();
  await password.fill('river lamp orange');
  await expect(shown(page.getByText('Strong password.'))).toBeVisible();

  // The password can be shown and hidden again.
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).not.toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(password).toHaveAttribute('type', 'password');

  // Forgotten password: asks for the email, then a code (no email is sent in preview).
  await page.getByRole('tab', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Forgot your password?' }).click();
  await expect(shown(page.getByText(/send a code to set a new password/))).toBeVisible();
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByRole('button', { name: 'Email me a reset code' }).click();
  await expect(shown(page.getByText('Enter a valid email address.'))).toBeVisible();
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await expect(shown(page.getByRole('tab', { name: 'Create account' }))).toBeVisible();
});

test('the app follows the phone’s light or dark setting, and Account can override it', async ({ page }) => {
  const background = () => page.evaluate(() => {
    // The screen's own background: the first full-size element with a solid colour.
    for (const el of Array.from(document.querySelectorAll('div'))) {
      const c = getComputedStyle(el).backgroundColor;
      if (el.clientHeight > 600 && c !== 'rgba(0, 0, 0, 0)') return c;
    }
    return '';
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.getByRole('button', { name: /Get started/ }).first().click();
  await page.getByRole('button', { name: /Start travelling/ }).click();
  await page.getByRole('tab', { name: /Account/ }).click();
  await expect(shown(page.getByText(/Matches your phone’s setting \(now dark\)/))).toBeVisible();
  expect(await background()).toBe('rgb(0, 0, 0)');

  // Choose Light: kept after a reload, even though the phone is still dark.
  await page.getByRole('tab', { name: 'Light' }).click();
  await expect(shown(page.getByText(/Always light/))).toBeVisible();
  await page.reload();
  await expect(shown(page.getByText(/Always light/))).toBeVisible();
  expect(await background()).toBe('rgb(242, 242, 247)');

  // Back to System follows the phone again.
  await page.getByRole('tab', { name: 'System' }).click();
  await expect(shown(page.getByText(/now dark/))).toBeVisible();
});
