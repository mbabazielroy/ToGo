// Account rules shared by the ToGo apps and the operations console: what a valid
// email and an acceptable new password look like, and what to tell people when
// Supabase Auth refuses a request.
//
// Passwords follow NIST SP 800-63B rather than "one capital, one symbol" rules:
//  - at least 8 characters (the server enforces the same minimum,
//    supabase/config.toml `minimum_password_length`);
//  - at most 72, because Supabase hashes with bcrypt, which ignores anything past
//    72 bytes (the server rejects longer ones);
//  - any characters, spaces and emoji included, and pasting allowed (password
//    managers);
//  - not a commonly used or easily guessed password, and not built from the
//    person's own email or name. In production, Supabase's leaked-password check
//    (HaveIBeenPwned) adds the full breach list on top of this short one.
//
// Messages never say whether an email has an account (no account enumeration).

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
/** Digits in the code Supabase emails for confirmation and password reset
 *  (supabase/config.toml `otp_length`). */
export const EMAIL_CODE_LENGTH = 8;
/** How long a code or link lasts, in minutes (`otp_expiry`). */
export const EMAIL_CODE_MINUTES = 30;
/** Seconds before another email can be asked for (`max_frequency`). */
export const RESEND_SECONDS = 60;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailLooksValid(email: string): boolean {
  const e = email.trim();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

/** Keeps only the digits of a pasted or typed code ("1234 5678" → "12345678"). */
export function cleanCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, EMAIL_CODE_LENGTH);
}

export function codeLooksValid(code: string): boolean {
  return new RegExp(`^\\d{${EMAIL_CODE_LENGTH}}$`).test(code);
}

// The most-used passwords of 8+ characters from public breach lists, plus local
// ones an attacker would try first. Lower-cased; compared after lower-casing.
const COMMON = new Set([
  '12345678', '123456789', '1234567890', '12345678910', '87654321', '11111111',
  '00000000', '88888888', '12341234', '11223344', '123123123', '147258369',
  '123qweasd', 'password', 'password1', 'password12', 'password123', 'passw0rd',
  'p@ssw0rd', 'p@ssword', 'pa55word', 'qwertyuiop', 'qwerty123', 'qwerty12',
  '1q2w3e4r', '1q2w3e4r5t', 'q1w2e3r4', 'qwer1234', 'asdfghjkl', 'asdf1234',
  'zxcvbnm1', '1qaz2wsx', 'zaq12wsx', 'iloveyou', 'iloveyou1', 'sunshine',
  'princess', 'football', 'baseball', 'superman', 'starwars', 'whatever',
  'trustno1', 'welcome1', 'welcome123', 'letmein1', 'abcd1234', 'abc12345',
  'abcdefgh', 'aa123456', 'a1234567', 'monkey123', 'dragon123', 'master123',
  'changeme', 'computer', 'internet', 'samsung1', 'michael1', 'jennifer',
  'liverpool', 'arsenal1', 'chelsea1', 'manchester', 'blessing', 'blessed1',
  'godisgood', 'jesus123', 'jesuschrist', 'mypassword', 'secret123', 'admin123',
  'administrator', 'default1', 'test1234', 'testing123', 'kampala1', 'kampala123',
  'uganda123', 'uganda256', 'mbarara1', 'mbarara123', 'togo1234', 'togo12345',
  'togopass', 'togobus1', 'buspass1', 'traveller', 'traveler1',
]);

export interface PasswordContext {
  email?: string | null;
  name?: string | null;
}

/** Why a new password isn't acceptable, written for the person, or null if it's fine. */
export function newPasswordProblem(password: string, ctx: PasswordContext = {}): string | null {
  // Count characters, not UTF-16 units, so emoji count once.
  const length = [...password].length;
  if (length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || COMMON.has(lower.replace(/[!.?]+$/, ''))) {
    return 'That password is too common. Try a few unrelated words together.';
  }
  if (/^(.)\1+$/.test(password)) return 'Avoid repeating one character. Try a few unrelated words together.';
  if (isSequence(lower)) return 'Avoid simple sequences like 12345678 or abcdefgh.';
  const local = normaliseEmail(ctx.email ?? '').split('@')[0] ?? '';
  if (local.length >= 4 && lower.includes(local)) return 'Don’t use your email address in your password.';
  const nameParts = (ctx.name ?? '').toLowerCase().split(/\s+/).filter((p) => p.length >= 4);
  if (nameParts.some((p) => lower.replace(/[^a-z]/g, '') === p || lower === `${p}123` || lower === `${p}1234`)) {
    return 'Don’t use just your name. Try a few unrelated words together.';
  }
  return null;
}

function isSequence(s: string): boolean {
  if (s.length < 4) return false;
  const up = [...s].every((c, i) => i === 0 || c.charCodeAt(0) - s.charCodeAt(i - 1) === 1);
  const down = [...s].every((c, i) => i === 0 || s.charCodeAt(i - 1) - c.charCodeAt(0) === 1);
  return up || down;
}

/** A rough guide for the meter under a new-password field. */
export function passwordStrength(password: string, ctx: PasswordContext = {}): 'weak' | 'ok' | 'strong' {
  if (newPasswordProblem(password, ctx)) return 'weak';
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  const length = [...password].length;
  if (length >= 14 || (length >= 11 && kinds >= 3)) return 'strong';
  return 'ok';
}

interface AuthLikeError { code?: string; status?: number; message?: string; name?: string; reasons?: string[] }

/**
 * A message for a failed sign-in, sign-up, code or password request. Uses the
 * error codes Supabase Auth returns (`AuthApiError.code`), then falls back to
 * its messages for older servers. Never confirms whether an account exists.
 */
export function authErrorMessage(e: unknown): string {
  const err = (e ?? {}) as AuthLikeError;
  const msg = err.message ?? '';
  switch (err.code) {
    case 'invalid_credentials':
    case 'user_not_found':
      return 'That email and password don’t match. Check them, or reset your password.';
    case 'wrong_current_password':
      return 'Your current password isn’t right.';
    case 'email_not_confirmed':
      return 'Confirm your email first. Enter the code we sent, or ask for a new one.';
    case 'user_already_exists':
    case 'email_exists':
      // Only reachable when confirmations are off (local development). With them
      // on, Supabase answers as if it worked and sends nothing new.
      return 'Check your email to continue. If you already have an account, sign in or reset your password.';
    case 'weak_password':
      if (err.reasons?.includes('pwned')) return 'That password has appeared in a data breach. Choose a different one.';
      return `Choose a stronger password: at least ${PASSWORD_MIN} characters, not a common one.`;
    case 'same_password':
      return 'Your new password must be different from your current one.';
    case 'otp_expired':
      return 'That code has expired or was already used. Ask for a new one.';
    case 'over_email_send_rate_limit':
      return 'Too many emails asked for. Wait a minute, then try again.';
    case 'over_request_rate_limit':
      return 'Too many attempts. Wait a few minutes, then try again.';
    case 'reauthentication_needed':
    case 'reauthentication_not_valid':
    case 'session_not_found':
    case 'session_expired':
    case 'refresh_token_not_found':
    case 'refresh_token_already_used':
      return 'For your security, sign in again, then try once more.';
    case 'flow_state_not_found':
    case 'flow_state_expired':
    case 'bad_code_verifier':
      return 'That link has expired or was opened on a different device. Use the code in the email instead, or ask for a new one.';
    case 'email_address_invalid':
    case 'email_address_not_authorized':
      return 'Enter a valid email address.';
    case 'signup_disabled':
      return 'New accounts can’t be created right now.';
    case 'user_banned':
      return 'This account is suspended. Contact support for help.';
    case 'captcha_failed':
      return 'The security check didn’t pass. Please try again.';
  }
  if (/invalid login credentials/i.test(msg)) return authErrorMessage({ code: 'invalid_credentials' });
  if (/email not confirmed/i.test(msg)) return authErrorMessage({ code: 'email_not_confirmed' });
  if (/token has expired|otp.*(expired|invalid)|invalid.*otp/i.test(msg)) return authErrorMessage({ code: 'otp_expired' });
  if (/rate limit|too many/i.test(msg) || err.status === 429) return authErrorMessage({ code: 'over_request_rate_limit' });
  if (/network|fetch|failed to fetch|timeout/i.test(msg)) return 'Network problem. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}

/** Whether a sign-in failed only because the email isn't confirmed yet. */
export function needsEmailConfirmation(e: unknown): boolean {
  const err = (e ?? {}) as AuthLikeError;
  return err.code === 'email_not_confirmed' || /email not confirmed/i.test(err.message ?? '');
}
