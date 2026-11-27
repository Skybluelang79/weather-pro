export interface AuthErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 80;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

export function normalizeAuthEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateLogin(values: { email: string; password: string }): AuthErrors {
  const errors: AuthErrors = {};
  if (!values.email) errors.email = 'Enter your email address.';
  else if (!EMAIL_PATTERN.test(values.email) || values.email.length > 254) errors.email = 'Enter a valid email address.';
  if (!values.password) errors.password = 'Enter your password.';
  else if (values.password.length > MAX_PASSWORD) errors.password = 'Password is too long.';
  return errors;
}

export function validateForgotPassword(email: string): AuthErrors {
  const errors: AuthErrors = {};
  if (!email) errors.email = 'Enter your email address.';
  else if (!EMAIL_PATTERN.test(email) || email.length > 254) errors.email = 'Enter a valid email address.';
  return errors;
}

export function validateSignup(values: { name: string; email: string; password: string; confirmPassword: string }): AuthErrors {
  const errors = validateLogin({ email: values.email, password: values.password });
  const name = values.name.trim();
  if (!name) errors.name = 'Enter your name.';
  else if (name.length > MAX_NAME) errors.name = `Name must be ${MAX_NAME} characters or fewer.`;
  if (values.password && values.password.length < MIN_PASSWORD) errors.password = `Use at least ${MIN_PASSWORD} characters.`;
  if (!values.confirmPassword) errors.confirmPassword = 'Confirm your password.';
  else if (values.password !== values.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

export function validatePasswordReset(values: { password: string; confirmPassword: string }): AuthErrors {
  const errors: AuthErrors = {};
  if (!values.password) errors.password = 'Enter a new password.';
  else if (values.password.length < MIN_PASSWORD) errors.password = `Use at least ${MIN_PASSWORD} characters.`;
  else if (values.password.length > MAX_PASSWORD) errors.password = 'Password is too long.';
  if (!values.confirmPassword) errors.confirmPassword = 'Confirm your password.';
  else if (values.password !== values.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

export function passwordStrength(password: string): { score: number; label: 'Weak' | 'Fair' | 'Strong' } {
  let score = 0;
  if (password.length >= MIN_PASSWORD) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return { score, label: score <= 1 ? 'Weak' : score <= 3 ? 'Fair' : 'Strong' };
}
