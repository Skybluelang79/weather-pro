import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/auth';
import { useModalFocus } from '../hooks/useModalFocus';
import { api } from '../services/api';
import {
  normalizeAuthEmail,
  passwordStrength,
  validateForgotPassword,
  validateLogin,
  validatePasswordReset,
  validateSignup,
} from '../services/authValidation';
import type { AuthErrors } from '../services/authValidation';
import { useToast } from './Toast';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

function clearResetQuery() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('reset')) return;
  url.searchParams.delete('reset');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const { signup, login } = useAuth();
  const { addToast } = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState<AuthErrors>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useModalFocus(open, onClose, modalRef);

  useEffect(() => {
    if (!open) return;
    const token = new URLSearchParams(window.location.search).get('reset') || '';
    setMode(token ? 'reset' : 'login');
    setResetToken(token);
    setNotice('');
    setError('');
    setErrors({});
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  }, [open]);

  if (!open) return null;

  const strength = passwordStrength(password);
  const needsPasswordConfirmation = mode === 'signup' || mode === 'reset';

  const closeModal = () => {
    clearResetQuery();
    onClose();
  };

  const switchMode = (next: Mode) => {
    if (next !== 'reset') clearResetQuery();
    setMode(next);
    setResetToken('');
    setNotice('');
    setError('');
    setErrors({});
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const focusInvalid = () => {
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = normalizeAuthEmail(email);

    if (mode === 'forgot') {
      const nextErrors = validateForgotPassword(normalizedEmail);
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        setError('Please fix the highlighted field.');
        focusInvalid();
        return;
      }
      setBusy(true);
      setError('');
      setErrors({});
      try {
        const result = await api.requestPasswordReset(normalizedEmail);
        setNotice(result.message || 'If an account exists for that email, a reset link has been sent.');
      } catch (err) {
        setError((err as Error).message || 'Could not request a password reset.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'reset') {
      const nextErrors = validatePasswordReset({ password, confirmPassword });
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        setError('Please fix the highlighted fields.');
        focusInvalid();
        return;
      }
      setBusy(true);
      setError('');
      setErrors({});
      try {
        const result = await api.resetPassword(resetToken, password);
        clearResetQuery();
        addToast('Password updated', 'success');
        setNotice(result.message || 'Password updated. You can now sign in.');
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setResetToken('');
        setMode('login');
      } catch (err) {
        setError((err as Error).message || 'Could not reset the password.');
      } finally {
        setBusy(false);
      }
      return;
    }

    const values = {
      name: name.trim(),
      email: normalizedEmail,
      password,
      confirmPassword,
    };
    const nextErrors = mode === 'signup' ? validateSignup(values) : validateLogin(values);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setError('Please fix the highlighted fields.');
      focusInvalid();
      return;
    }

    setBusy(true);
    setError('');
    setErrors({});
    try {
      if (mode === 'signup') {
        await signup({ name: values.name, email: values.email, password });
        addToast('Account created', 'success');
      } else {
        await login({ email: values.email, password });
        addToast('Signed in', 'success');
      }
      setPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err) {
      const message = (err as Error).message || 'Could not continue';
      setError(message);
      if (/already exists/i.test(message)) setErrors({ email: message });
    } finally {
      setBusy(false);
    }
  };

  const title = {
    login: 'Welcome back',
    signup: 'Create your account',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
  }[mode];

  const submitLabel = {
    login: busy ? 'Signing in…' : 'Sign in',
    signup: busy ? 'Creating account…' : 'Create account',
    forgot: busy ? 'Sending link…' : 'Send reset link',
    reset: busy ? 'Updating password…' : 'Update password',
  }[mode];

  return (
    <div className="auth-overlay" onClick={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
      <div ref={modalRef} className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" tabIndex={-1}>
        <div className="auth-header">
          <h3 id="auth-title">{title}</h3>
          <button className="map-close" onClick={closeModal} aria-label="Close">✕</button>
        </div>
        {(mode === 'login' || mode === 'signup') && (
          <div className="auth-switch" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'active' : ''}
              onClick={() => switchMode('login')}
              disabled={busy}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => switchMode('signup')}
              disabled={busy}
            >
              Sign up
            </button>
          </div>
        )}
        <form ref={formRef} className="auth-form" onSubmit={handleSubmit} noValidate>
          {mode === 'signup' && (
            <label className={errors.name ? 'has-error' : ''}>
              <span>Name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                autoComplete="name"
                autoFocus
                maxLength={80}
                disabled={busy}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'auth-name-error' : undefined}
              />
              {errors.name && <small id="auth-name-error" className="field-error">{errors.name}</small>}
            </label>
          )}
          {mode !== 'reset' && (
            <label className={errors.email ? 'has-error' : ''}>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoCapitalize="none"
                inputMode="email"
                spellCheck={false}
                autoFocus={mode === 'login' || mode === 'forgot'}
                maxLength={254}
                disabled={busy}
                required
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'auth-email-error' : undefined}
              />
              {errors.email && <small id="auth-email-error" className="field-error">{errors.email}</small>}
            </label>
          )}
          {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
            <label className={errors.password ? 'has-error' : ''}>
              <span className="auth-label-row">
                <span>{mode === 'reset' ? 'New password' : 'Password'}</span>
                {mode === 'login' && (
                  <button
                    type="button"
                    className="auth-forgot"
                    onClick={() => switchMode('forgot')}
                    aria-label="Forgot password?"
                    disabled={busy}
                  >
                    Forgot password?
                  </button>
                )}
              </span>
              <span className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={needsPasswordConfirmation ? 'At least 8 characters' : 'Your password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={needsPasswordConfirmation ? 8 : undefined}
                  maxLength={128}
                  spellCheck={false}
                  disabled={busy}
                  required
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'auth-password-error' : needsPasswordConfirmation ? 'auth-password-hint' : undefined}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  disabled={busy}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
              {errors.password && <small id="auth-password-error" className="field-error">{errors.password}</small>}
              {!errors.password && needsPasswordConfirmation && (
                <small id="auth-password-hint" className="auth-hint">Use 8+ characters with a mix of letters, numbers and symbols.</small>
              )}
            </label>
          )}
          {(mode === 'signup' || mode === 'reset') && password && (
            <div className="password-strength" data-strength={strength.label.toLowerCase()} aria-live="polite">
              <div className="password-strength-track">
                <span style={{ width: `${Math.max(12, strength.score * 20)}%` }} />
              </div>
              <small>{strength.label} password</small>
            </div>
          )}
          {needsPasswordConfirmation && (
            <label className={errors.confirmPassword ? 'has-error' : ''}>
              <span>Confirm password</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
                maxLength={128}
                spellCheck={false}
                disabled={busy}
                required
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby={errors.confirmPassword ? 'auth-confirm-error' : undefined}
              />
              {errors.confirmPassword && <small id="auth-confirm-error" className="field-error">{errors.confirmPassword}</small>}
            </label>
          )}
          {notice && <div className="auth-notice" role="status">{notice}</div>}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="auth-submit" disabled={busy}>
            {submitLabel}
          </button>
          {(mode === 'forgot' || mode === 'reset' || notice) && (
            <button type="button" className="auth-back" onClick={() => switchMode('login')} disabled={busy}>
              Back to sign in
            </button>
          )}
        </form>
        <p className="auth-note">
          {mode === 'signup'
            ? 'Your current plan, saved cities and history move into your new account.'
            : mode === 'forgot'
              ? "We'll only send a link if an account exists for that email."
              : mode === 'reset'
                ? 'Reset links expire after 30 minutes and can be used once.'
                : 'Your plan, saved cities and history stay with your account.'}
        </p>
      </div>
    </div>
  );
}
