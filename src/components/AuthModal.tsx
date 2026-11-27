import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/auth';
import { useModalFocus } from '../hooks/useModalFocus';
import { useToast } from './Toast';
import { normalizeAuthEmail, passwordStrength, validateLogin, validateSignup } from '../services/authValidation';
import type { AuthErrors } from '../services/authValidation';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

type Mode = 'login' | 'signup';

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const { signup, login } = useAuth();
  const { addToast } = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<AuthErrors>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useModalFocus(open, onClose, modalRef);

  useEffect(() => {
    if (!open) return;
    setMode('login');
    setError('');
    setErrors({});
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  }, [open]);

  if (!open) return null;

  const strength = passwordStrength(password);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setErrors({});
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const values = {
      name: name.trim(),
      email: normalizeAuthEmail(email),
      password,
      confirmPassword,
    };
    const nextErrors = mode === 'signup' ? validateSignup(values) : validateLogin(values);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setError('Please fix the highlighted fields.');
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
      });
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

  return (
    <div className="auth-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={modalRef} className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" tabIndex={-1}>
        <div className="auth-header">
          <h3 id="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h3>
          <button className="map-close" onClick={onClose} aria-label="Close sign in">✕</button>
        </div>
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
              autoFocus={mode === 'login'}
              maxLength={254}
              disabled={busy}
              required
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'auth-email-error' : undefined}
            />
            {errors.email && <small id="auth-email-error" className="field-error">{errors.email}</small>}
          </label>
          <label className={errors.password ? 'has-error' : ''}>
            <span>Password</span>
            <span className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={mode === 'signup' ? 8 : undefined}
                maxLength={128}
                spellCheck={false}
                disabled={busy}
                required
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'auth-password-error' : mode === 'signup' ? 'auth-password-hint' : undefined}
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
            {!errors.password && mode === 'signup' && (
              <small id="auth-password-hint" className="auth-hint">Use 8+ characters with a mix of letters, numbers and symbols.</small>
            )}
          </label>
          {mode === 'signup' && password && (
            <div className="password-strength" data-strength={strength.label.toLowerCase()} aria-live="polite">
              <div className="password-strength-track">
                <span style={{ width: `${Math.max(12, strength.score * 20)}%` }} />
              </div>
              <small>{strength.label} password</small>
            </div>
          )}
          {mode === 'signup' && (
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
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p className="auth-note">
          {mode === 'signup'
            ? 'Your current plan, saved cities and history move into your new account.'
            : 'Your plan, saved cities and history stay with your account.'}
        </p>
      </div>
    </div>
  );
}
