/** A mobile number is optional; when given it must look complete: 9–15 digits,
 *  an optional leading +, and spaces, dashes or brackets between digits. */
export function phoneLooksValid(phone: string): boolean {
  const p = phone.trim();
  if (!p) return true;
  if (!/^\+?[0-9 ()-]+$/.test(p)) return false;
  const digits = p.replace(/\D/g, '').length;
  return digits >= 9 && digits <= 15;
}

export const PHONE_HINT = 'That phone number looks incomplete. Use a format like +256 700 123456.';
