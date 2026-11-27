import { describe, expect, it } from 'vitest';
import {
  normalizeAuthEmail,
  passwordStrength,
  validateForgotPassword,
  validateLogin,
  validatePasswordReset,
  validateSignup,
} from '../services/authValidation';

describe('auth validation', () => {
  it('normalizes emails', () => {
    expect(normalizeAuthEmail('  User@Example.COM ')).toBe('user@example.com');
  });

  it('rejects missing login fields', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: 'Enter your email address.',
      password: 'Enter your password.',
    });
  });

  it('rejects malformed login emails', () => {
    expect(validateLogin({ email: 'not-an-email', password: 'password' }).email)
      .toBe('Enter a valid email address.');
  });

  it('accepts valid login details', () => {
    expect(validateLogin({ email: 'user@example.com', password: 'password' })).toEqual({});
  });

  it('requires a name and matching passwords for signup', () => {
    const errors = validateSignup({
      name: '  ',
      email: 'user@example.com',
      password: 'password1',
      confirmPassword: 'different',
    });
    expect(errors.name).toBe('Enter your name.');
    expect(errors.confirmPassword).toBe('Passwords do not match.');
  });

  it('enforces the minimum signup password length', () => {
    const errors = validateSignup({
      name: 'User',
      email: 'user@example.com',
      password: 'short',
      confirmPassword: 'short',
    });
    expect(errors.password).toBe('Use at least 8 characters.');
  });

  it('accepts complete signup details', () => {
    expect(validateSignup({
      name: 'User',
      email: 'user@example.com',
      password: 'StrongPass1!',
      confirmPassword: 'StrongPass1!',
    })).toEqual({});
  });

  it('validates password reset email input', () => {
    expect(validateForgotPassword('')).toEqual({ email: 'Enter your email address.' });
    expect(validateForgotPassword('bad')).toEqual({ email: 'Enter a valid email address.' });
    expect(validateForgotPassword('user@example.com')).toEqual({});
  });

  it('validates new password and confirmation', () => {
    expect(validatePasswordReset({ password: '', confirmPassword: '' })).toEqual({
      password: 'Enter a new password.',
      confirmPassword: 'Confirm your password.',
    });
    expect(validatePasswordReset({ password: 'short', confirmPassword: 'short' }).password)
      .toBe('Use at least 8 characters.');
    expect(validatePasswordReset({ password: 'StrongPass1!', confirmPassword: 'different' }).confirmPassword)
      .toBe('Passwords do not match.');
    expect(validatePasswordReset({ password: 'StrongPass1!', confirmPassword: 'StrongPass1!' })).toEqual({});
  });

  it('rates password strength', () => {
    expect(passwordStrength('password').label).toBe('Weak');
    expect(passwordStrength('StrongPass1!').label).toBe('Strong');
    expect(passwordStrength('abc').label).toBe('Weak');
  });
});
