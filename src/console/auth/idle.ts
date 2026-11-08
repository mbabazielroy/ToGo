import { useEffect } from 'react';

// Staff consoles sign out after a period without use (OWASP ASVS 3.3: 30 minutes
// or less for privileged work), so a computer left open in a depot office can't
// be used by someone else. Activity in any of the console's tabs counts.

export const IDLE_MINUTES = 30;
const KEY = 'togo.console.lastActive';
export const IDLE_NOTICE_KEY = 'togo.console.idleSignedOut';

export function isIdle(lastActive: number, now: number, minutes = IDLE_MINUTES): boolean {
  return now - lastActive >= minutes * 60_000;
}

function readLast(): number {
  try { return Number(localStorage.getItem(KEY)) || Date.now(); } catch { return Date.now(); }
}
function writeLast(t: number) {
  try { localStorage.setItem(KEY, String(t)); } catch { /* storage blocked: this tab's timer still works */ }
}

/** A fresh sign-in or password change counts as activity. */
export function markActive() { writeLast(Date.now()); }

/** Calls `onIdle` once the console has gone unused for IDLE_MINUTES. */
export function useIdleSignOut(enabled: boolean, onIdle: () => void) {
  useEffect(() => {
    if (!enabled) return;
    let local = Date.now();
    // A session restored after the console sat closed past the limit ends now.
    if (isIdle(readLast(), local)) { onIdle(); return; }
    writeLast(local);
    let lastWrite = local;
    const touch = () => {
      local = Date.now();
      if (local - lastWrite > 15_000) { writeLast(local); lastWrite = local; }
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = window.setInterval(() => {
      const last = Math.max(local, readLast());
      if (isIdle(last, Date.now())) onIdle();
    }, 30_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(timer);
    };
  }, [enabled, onIdle]);
}
