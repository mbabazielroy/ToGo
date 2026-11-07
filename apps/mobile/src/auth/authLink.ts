// Reads a sign-in link (email confirmation or password reset) opened in the app.
//
// Security: only PKCE links are accepted. They carry a one-time `code` that can be
// exchanged for a session only together with a secret (the code verifier) that
// this phone stored when it asked for the email. A link made on another device,
// or a crafted link carrying someone else's tokens, cannot sign this phone in.
// Links with `access_token`/`refresh_token` (the older implicit flow) are ignored
// on purpose: accepting them would let anyone who sends a link choose which
// account the phone is signed into (login CSRF).

export interface AuthLink {
  code: string;
  /** The link was for a password reset (it points at the /reset screen). */
  recovery: boolean;
}

export function parseAuthLink(url: string | null | undefined): AuthLink | null {
  if (!url) return null;
  const hashAt = url.indexOf('#');
  const noHash = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const queryAt = noHash.indexOf('?');
  if (queryAt < 0) return null;
  const path = noHash.slice(0, queryAt);
  const params = new URLSearchParams(noHash.slice(queryAt + 1));
  const code = params.get('code');
  // Supabase codes are UUID-like; reject anything odd rather than send it on.
  if (!code || !/^[A-Za-z0-9-]{8,128}$/.test(code)) return null;
  return { code, recovery: /(^|[/:])reset\/?$/.test(path) };
}
