import { describe, expect, it } from 'vitest';
import { isIdle, IDLE_MINUTES } from './idle';

describe('console idle sign-out', () => {
  it('signs out after 30 minutes without use, not before', () => {
    const t0 = 1_000_000;
    expect(IDLE_MINUTES).toBe(30);
    expect(isIdle(t0, t0 + 29 * 60_000)).toBe(false);
    expect(isIdle(t0, t0 + 30 * 60_000)).toBe(true);
  });
});
