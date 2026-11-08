import { describe, expect, it } from 'vitest';
import {
  authErrorMessage, cleanCode, codeLooksValid, emailLooksValid, needsEmailConfirmation,
  newPasswordProblem, normaliseEmail, passwordStrength, EMAIL_CODE_LENGTH,
} from './authRules';

describe('emails', () => {
  it('accepts ordinary addresses and trims them', () => {
    expect(emailLooksValid(' amina@example.co.ug ')).toBe(true);
    expect(normaliseEmail(' Amina@Example.COM ')).toBe('amina@example.com');
  });
  it('rejects malformed ones', () => {
    for (const bad of ['', 'amina', 'amina@', '@example.com', 'a b@example.com', 'amina@example', 'a@b.c']) {
      expect(emailLooksValid(bad)).toBe(false);
    }
  });
});

describe('email codes', () => {
  it('keeps only digits, up to the code length', () => {
    expect(cleanCode('1234 5678')).toBe('12345678');
    expect(cleanCode('12-34-56-78-99')).toHaveLength(EMAIL_CODE_LENGTH);
    expect(codeLooksValid('12345678')).toBe(true);
    expect(codeLooksValid('1234567')).toBe(false);
  });
});

describe('new passwords', () => {
  it('needs at least 8 characters and at most 72 bytes', () => {
    expect(newPasswordProblem('short')).toMatch(/at least 8/);
    expect(newPasswordProblem('a'.repeat(30) + 'b'.repeat(43))).toMatch(/at most 72/);
    expect(newPasswordProblem('river lamp orange')).toBeNull();
  });
  it('allows spaces, symbols and emoji, with no composition rules', () => {
    expect(newPasswordProblem('correct horse battery')).toBeNull();
    expect(newPasswordProblem('mangoes🚌kampala')).toBeNull();
    expect(newPasswordProblem('alllowercaseletters')).toBeNull();
  });
  it('refuses common, repeated and sequential passwords', () => {
    expect(newPasswordProblem('Password123')).toMatch(/too common/);
    expect(newPasswordProblem('password1!')).toMatch(/too common/);
    expect(newPasswordProblem('kampala123')).toMatch(/too common/);
    expect(newPasswordProblem('aaaaaaaaa')).toMatch(/repeating/);
    expect(newPasswordProblem('23456789')).toMatch(/sequences/);
    expect(newPasswordProblem('hgfedcba')).toMatch(/sequences/);
  });
  it('refuses the person’s own email or name', () => {
    expect(newPasswordProblem('xx-amina.n-2026', { email: 'amina.n@example.com' })).toMatch(/email/);
    expect(newPasswordProblem('Namuli1234', { name: 'Aisha Namuli' })).toMatch(/name/);
    expect(newPasswordProblem('namuli river stone', { name: 'Aisha Namuli' })).toBeNull();
  });
  it('rates strength for the meter', () => {
    expect(passwordStrength('password')).toBe('weak');
    expect(passwordStrength('riverlamp')).toBe('ok');
    expect(passwordStrength('river lamp orange')).toBe('strong');
  });
});

describe('auth error messages', () => {
  it('never says whether an account exists', () => {
    const wrongPassword = authErrorMessage({ code: 'invalid_credentials' });
    const noAccount = authErrorMessage({ code: 'user_not_found' });
    expect(wrongPassword).toBe(noAccount);
    expect(authErrorMessage({ code: 'user_already_exists' })).not.toMatch(/already (registered|exists)/i);
  });
  it('explains the common failures', () => {
    expect(authErrorMessage({ code: 'weak_password', reasons: ['pwned'] })).toMatch(/data breach/);
    expect(authErrorMessage({ code: 'weak_password', reasons: ['length'] })).toMatch(/stronger/);
    expect(authErrorMessage({ code: 'otp_expired' })).toMatch(/expired/);
    expect(authErrorMessage({ code: 'same_password' })).toMatch(/different/);
    expect(authErrorMessage({ code: 'wrong_current_password' })).toMatch(/current password/);
    expect(authErrorMessage({ code: 'over_email_send_rate_limit' })).toMatch(/Wait a minute/);
    expect(authErrorMessage({ code: 'bad_code_verifier' })).toMatch(/different device/);
  });
  it('falls back on the message for older servers, and hides unknown ones', () => {
    expect(authErrorMessage(new Error('Invalid login credentials'))).toMatch(/don’t match/);
    expect(authErrorMessage({ message: 'Token has expired or is invalid' })).toMatch(/expired/);
    expect(authErrorMessage({ status: 429, message: 'x' })).toMatch(/Too many/);
    expect(authErrorMessage(new Error('duplicate key value violates unique constraint'))).toBe('Something went wrong. Please try again.');
  });
  it('spots an unconfirmed email', () => {
    expect(needsEmailConfirmation({ code: 'email_not_confirmed' })).toBe(true);
    expect(needsEmailConfirmation(new Error('Email not confirmed'))).toBe(true);
    expect(needsEmailConfirmation({ code: 'invalid_credentials' })).toBe(false);
  });
});
