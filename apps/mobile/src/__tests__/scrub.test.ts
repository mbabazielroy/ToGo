import { describe, it, expect } from 'vitest';
import { scrubEvent, scrubText, scrubUrl, scrubBreadcrumb } from '../lib/scrub';

describe('crash report scrubbing', () => {
  it('removes emails, phones, tokens, boarding codes and ids from text', () => {
    const s = scrubText('jane.doe@example.com +256 772 123456 0772123456 TOGO:K7P2Q9 eyJhbGciOi.eyJzdWIi.sig id 3f2c1b9a-7d4e-4c1a-9b2f-1e2d3c4b5a69 password=hunter2');
    expect(s).not.toMatch(/jane|772|K7P2Q9|eyJ|3f2c1b9a|hunter2/);
    expect(s).toContain('[email]');
    expect(s).toContain('TOGO:[code]');
  });

  it('drops the query and fragment from URLs', () => {
    expect(scrubUrl('https://x.supabase.co/rest/v1/bookings?id=eq.123&select=*')).toBe('https://x.supabase.co/rest/v1/bookings');
    expect(scrubUrl('togo://reset?code=abc#access_token=t')).toBe('togo://reset');
  });

  it('removes the user, request details and personal text from an event', () => {
    const e = scrubEvent({
      user: { id: 'u1', email: 'a@b.co' },
      extra: { phone: '0772123456' },
      request: { url: 'https://x.co/a?b=c', headers: { Authorization: 'Bearer x' }, cookies: 'c', data: '{}', query_string: 'b=c' },
      message: 'failed for a@b.co',
      exception: { values: [{ type: 'Error', value: 'Booking TOGO:SECRET1 for a@b.co' }] },
      breadcrumbs: [{ category: 'fetch', data: { url: 'https://x.co/rest?id=eq.1', body: 'x' } }, { category: 'console', message: 'hi a@b.co', data: { arguments: ['a@b.co'] } }],
    });
    expect(e.user).toBeUndefined();
    expect(e.extra).toBeUndefined();
    expect(e.request).toEqual({ url: 'https://x.co/a' });
    expect(e.message).toBe('failed for [email]');
    expect(e.exception.values[0].value).toBe('Booking TOGO:[code] for [email]');
    expect(e.breadcrumbs[0].data).toEqual({ url: 'https://x.co/rest' });
    expect(e.breadcrumbs[1]).toEqual({ category: 'console', message: 'hi [email]', data: {} });
  });

  it('leaves odd input alone', () => {
    expect(scrubEvent(null)).toBeNull();
    expect(scrubBreadcrumb(undefined)).toBeUndefined();
    expect(scrubText(undefined)).toBeUndefined();
  });
});
