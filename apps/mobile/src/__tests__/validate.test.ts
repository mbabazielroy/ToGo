import { describe, it, expect } from 'vitest';
import { phoneLooksValid } from '@/lib/validate';

describe('phoneLooksValid', () => {
  it('accepts an empty (optional) number', () => {
    expect(phoneLooksValid('')).toBe(true);
    expect(phoneLooksValid('   ')).toBe(true);
  });
  it('accepts Ugandan numbers with or without spaces and +', () => {
    expect(phoneLooksValid('+256 700 123456')).toBe(true);
    expect(phoneLooksValid('256700123456')).toBe(true);
    expect(phoneLooksValid('0700 123 456')).toBe(true);
    expect(phoneLooksValid('+256-700-123456')).toBe(true);
  });
  it('rejects incomplete, too long or non-numeric input', () => {
    expect(phoneLooksValid('123')).toBe(false);
    expect(phoneLooksValid('+256 700 123 456 789 0')).toBe(false);
    expect(phoneLooksValid('call me')).toBe(false);
    expect(phoneLooksValid('+256 (0)700-123-45x')).toBe(false);
  });
});
