import { useRef, useState } from 'react';
import { useAuth } from '../context/auth';
import { useModalFocus } from '../hooks/useModalFocus';
import { useToast } from './Toast';

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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalFocus(open, onClose, modalRef);

  if (!open) return null;

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') {
        await signup({ name, email, password });
        addToast('Account created', 'success');
      } else {
        await login({ email, password });
        addToast('Signed in', 'success');
      }
      setPassword('');
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Could not continue');
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
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => switchMode('signup')}
          >
            Sign up
          </button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label>
              Name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                autoComplete="name"
                maxLength={80}
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={mode === 'signup' ? 8 : undefined}
              required
            />
          </label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p className="auth-note">Your plan, saved cities and history stay with your account.</p>
      </div>
    </div>
  );
}
