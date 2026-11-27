import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { useModalFocus } from '../hooks/useModalFocus';
import { useToast } from './Toast';
import type { AlertNotification } from '../types';

interface NotificationInboxProps {
  open: boolean;
  onClose: () => void;
  onGoToAlerts: () => void;
}

export default function NotificationInbox({ open, onClose, onGoToAlerts }: NotificationInboxProps) {
  const { addToast } = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useModalFocus(open, onClose, dialogRef);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setNotifications(await api.getNotifications());
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const markRead = async (notification: AlertNotification) => {
    if (notification.readAt) return;
    try {
      await api.markNotificationRead(notification.id);
      setNotifications(current => current.map(item => item.id === notification.id ? { ...item, readAt: Date.now() } : item));
    } catch (err) {
      addToast((err as Error).message || 'Could not mark notification as read', 'error');
    }
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(current => current.map(item => ({ ...item, readAt: item.readAt || Date.now() })));
    } catch (err) {
      addToast((err as Error).message || 'Could not update notifications', 'error');
    }
  };

  if (!open) return null;

  return (
    <div className="auth-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        className="auth-modal notification-inbox"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inbox-title"
        tabIndex={-1}
      >
        <div className="auth-header">
          <h3 id="inbox-title">Weather alert inbox</h3>
          <button className="map-close" onClick={onClose} aria-label="Close notifications">✕</button>
        </div>
        <div className="inbox-actions">
          <button onClick={() => void markAllRead()} disabled={loading || notifications.every(item => item.readAt)}>Mark all read</button>
          <button onClick={() => { onClose(); onGoToAlerts(); }}>Manage rules</button>
        </div>
        {loading && <p className="premium-loading">Loading notifications…</p>}
        {error && <p className="premium-error" role="alert">{error}</p>}
        {!loading && !error && notifications.length === 0 && (
          <p className="alert-empty">No alerts yet. Your triggered rules will appear here.</p>
        )}
        <div className="notification-list inbox-list">
          {notifications.map(notification => (
            <button
              type="button"
              key={notification.id}
              className={`notification-item inbox-item ${notification.readAt ? '' : 'unread'}`}
              onClick={() => void markRead(notification)}
            >
              <span className="notification-icon" aria-hidden="true">!</span>
              <span>
                <strong>{notification.city}</strong>
                <span className="inbox-message">{notification.message}</span>
                <span className="notification-meta">
                  {new Date(notification.createdAt).toLocaleString()}
                  {notification.readAt ? ' · Read' : ' · Unread'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
