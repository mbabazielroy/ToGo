import type { Locator, Page } from '@playwright/test';

/**
 * Fix the clock at 05:30 Kampala time today, before the first departure, so the
 * preview's departures are always ahead and check-in (2 hours before pickup) is
 * open for the 07:00 bus. The preview builds its timetable from "today".
 */
export async function morning(page: Page) {
  const today = new Date().toISOString().slice(0, 10);
  await page.clock.install({ time: new Date(`${today}T05:30:00+03:00`) });
}

/** The first match that is on screen. Expo Router keeps earlier screens mounted
 *  (hidden) in the stack, so the same text can exist more than once. */
export function shown(locator: Locator): Locator {
  return locator.filter({ visible: true }).first();
}

/** Press a button in the app's confirmation dialog (on web, `ask()` shows an
 *  in-page dialog instead of the browser's confirm). */
export async function answerDialog(page: Page, button = 'Confirm') {
  await page.getByRole('alertdialog').getByRole('button', { name: button, exact: true }).click();
}
