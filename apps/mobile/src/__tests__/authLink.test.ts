import { describe, it, expect } from 'vitest';
import { parseAuthLink } from '../auth/authLink';

const CODE = '3f2c1b9a-7d4e-4c1a-9b2f-1e2d3c4b5a69';

describe('parseAuthLink', () => {
  it('accepts PKCE code links and spots reset links', () => {
    expect(parseAuthLink(`togo://?code=${CODE}`)).toEqual({ code: CODE, recovery: false });
    expect(parseAuthLink(`togo://reset?code=${CODE}`)).toEqual({ code: CODE, recovery: true });
    expect(parseAuthLink(`exp://192.168.1.21:8081/--/reset?code=${CODE}`)).toEqual({ code: CODE, recovery: true });
  });

  it('ignores token links, so a crafted link cannot pick the signed-in account', () => {
    expect(parseAuthLink('togo://#access_token=a.b.c&refresh_token=r&type=recovery')).toBeNull();
    expect(parseAuthLink('togo://?access_token=a.b.c&refresh_token=r')).toBeNull();
  });

  it('ignores unrelated or malformed links', () => {
    expect(parseAuthLink(null)).toBeNull();
    expect(parseAuthLink('togo://trip/abc')).toBeNull();
    expect(parseAuthLink('togo://?code=')).toBeNull();
    expect(parseAuthLink('togo://?code=<script>')).toBeNull();
    expect(parseAuthLink(`togo://resetting?code=${CODE}`)?.recovery).toBe(false);
  });
});
