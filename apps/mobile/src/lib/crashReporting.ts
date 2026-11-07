import * as Sentry from '@sentry/react-native';
import { scrubBreadcrumb, scrubEvent } from './scrub';
import { APP_VARIANT } from '../env';

// Crash reporting for release builds (Sentry). It is off unless
// EXPO_PUBLIC_SENTRY_DSN is set at build time, and always off in development.
//
// What is sent: the error, the stack trace, the app version and variant, and basic
// device details (model, OS version). What is not: the person's account, email,
// phone number, boarding codes, sign-in tokens, screenshots, the screen layout or
// the query part of URLs (see scrub.ts). No performance tracing. The privacy
// policy and the store privacy answers describe this (docs/STORE_LAUNCH.md).

const DSN = (process.env.EXPO_PUBLIC_SENTRY_DSN ?? '').trim();
export const CRASH_REPORTING = DSN.startsWith('https://') && !__DEV__;

const NETWORK = /network|fetch|Failed to fetch|timeout|offline/i;

if (CRASH_REPORTING) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || 'production',
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 50,
    initialScope: { tags: { variant: APP_VARIANT } },
    beforeBreadcrumb: (b) => scrubBreadcrumb(b),
    beforeSend: (e) => scrubEvent(e),
  });
}

/**
 * Report an error the app recovered from (a failed reminder, a screen that crashed
 * and showed "Try again"). Lost connections are normal and are not reported.
 */
export function reportError(error: unknown, where: string): void {
  if (!CRASH_REPORTING) return;
  const message = (error as Error)?.message ?? String(error);
  if (NETWORK.test(message)) return;
  Sentry.captureException(error, { tags: { where } });
}
