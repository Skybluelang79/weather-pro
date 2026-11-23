import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useSubscription } from '../context/subscription';
import { useToast } from './Toast';
import UpgradeCard from './UpgradeCard';
import { urlBase64ToUint8Array } from '../services/helpers';
import type { AlertChannels, AlertMetric, AlertNotification, AlertRule } from '../types';

interface AlertRulesProps {
  lat?: number;
  lon?: number;
  city: string;
  unit: string;
  onUpgrade: () => void;
}

const METRICS: Array<{ value: AlertMetric; label: string; hint: string }> = [
  { value: 'temperature', label: 'Temperature', hint: '°C or °F' },
  { value: 'rain_probability', label: 'Rain probability', hint: 'percent' },
  { value: 'wind_speed', label: 'Wind gust', hint: 'km/h or mph' },
  { value: 'air_quality', label: 'Air quality (AQI)', hint: 'US AQI' },
];

export default function AlertRules({ lat, lon, city, unit, onUpgrade }: AlertRulesProps) {
  const { hasFeature } = useSubscription();
  const { addToast } = useToast();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState<AlertMetric>('rain_probability');
  const [operator, setOperator] = useState<'above' | 'below'>('above');
  const [threshold, setThreshold] = useState('70');
  const [leadMinutes, setLeadMinutes] = useState('60');
  const [channel, setChannel] = useState('in-app');
  const [channels, setChannels] = useState<AlertChannels | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextRules, nextNotifications] = await Promise.all([
        api.getAlertRules(true),
        api.getNotifications(),
      ]);
      setRules(nextRules);
      setNotifications(nextNotifications);
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Could not load alert rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasFeature('customAlerts')) return;
    load().catch(() => {});
    api.getAlertChannels().then(setChannels).catch(() => setChannels(null));
  }, [hasFeature, load]);

  const enablePush = async () => {
    if (!channels?.push || !channels.pushPublicKey) {
      addToast('Push notifications are not configured', 'error');
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      addToast('This browser does not support push notifications', 'error');
      return;
    }
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        addToast('Notification permission was denied', 'error');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(channels.pushPublicKey) as BufferSource,
      });
      await api.savePushSubscription(subscription.toJSON());
      addToast('Push alerts enabled', 'success');
    } catch (err) {
      addToast((err as Error).message || 'Could not enable push alerts', 'error');
    } finally {
      setPushBusy(false);
    }
  };

  if (!hasFeature('customAlerts')) {
    return (
      <UpgradeCard
        title="Personalized Weather Alerts"
        description="Create rules like “alert me when rain probability passes 70%” or “tell me 30 minutes before rain”. Subscribers also get heat, wind and air-quality warnings."
        onUpgrade={onUpgrade}
      />
    );
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lat === undefined || lon === undefined) {
      addToast('Search for a location first', 'error');
      return;
    }
    try {
      await api.createAlertRule({
        city: city || 'Selected location',
        lat,
        lon,
        metric,
        operator,
        threshold: Number(threshold),
        leadMinutes: metric === 'rain_probability' ? Number(leadMinutes) : 0,
        channels: [channel],
        units: unit === 'F' ? 'imperial' : 'metric',
      });
      addToast('Alert rule created', 'success');
      await load();
    } catch (err) {
      addToast((err as Error).message || 'Could not create alert', 'error');
    }
  };

  const toggle = async (rule: AlertRule) => {
    try {
      await api.updateAlertRule(rule.id, !rule.enabled);
      await load();
    } catch (err) {
      addToast((err as Error).message || 'Could not update alert', 'error');
    }
  };

  const remove = async (id: string) => {
    try {
      await api.removeAlertRule(id);
      await load();
      addToast('Alert removed', 'info');
    } catch (err) {
      addToast((err as Error).message || 'Could not remove alert', 'error');
    }
  };

  const metricLabel = (value: AlertMetric) => METRICS.find(m => m.value === value)?.label || value;

  return (
    <section className="alerts-panel animate-slide-up">
      <div className="glass-panel alerts-section">
        <div className="section-title">Create an Alert <span className="pro-chip">PRO</span></div>
        <p className="premium-subtitle">Rules are evaluated against live forecast data for {city || 'the selected location'}.</p>
        <form className="alert-form" onSubmit={create}>
          <label>
            <span>When</span>
            <select value={metric} onChange={e => setMetric(e.target.value as AlertMetric)}>
              {METRICS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>Is</span>
            <select value={operator} onChange={e => setOperator(e.target.value as 'above' | 'below')}>
              <option value="above">above</option>
              <option value="below">below</option>
            </select>
          </label>
          <label>
            <span>Threshold ({METRICS.find(m => m.value === metric)?.hint})</span>
            <input type="number" step="any" value={threshold} onChange={e => setThreshold(e.target.value)} required />
          </label>
          {metric === 'rain_probability' && (
            <label>
              <span>Lead time (minutes)</span>
              <input type="number" min="0" max="180" step="30" value={leadMinutes} onChange={e => setLeadMinutes(e.target.value)} />
            </label>
          )}
          <label>
            <span>Deliver via</span>
            <select value={channel} onChange={e => setChannel(e.target.value)}>
              <option value="in-app">In-app</option>
              <option value="email" disabled={!channels?.email}>Email{channels && !channels.email ? ' (not configured)' : ''}</option>
              <option value="push" disabled={!channels?.push}>Push{channels && !channels.push ? ' (not configured)' : ''}</option>
              <option value="sms" disabled={!channels?.sms}>SMS{channels && !channels.sms ? ' (not configured)' : ''}</option>
            </select>
          </label>
          <button className="alert-create" type="submit">Create alert</button>
        </form>
        <div className="alert-delivery">
          {channels?.push && (
            <button className="push-enable" onClick={enablePush} disabled={pushBusy}>
              {pushBusy ? 'Enabling…' : 'Enable browser notifications'}
            </button>
          )}
          <p className="premium-disclaimer">
            In-app alerts are always on. Email, SMS and push require the matching provider keys; webhook forwarding works independently.
          </p>
        </div>
      </div>

      <div className="glass-panel alerts-section">
        <div className="section-title">Your Rules</div>
        {loading && <div className="premium-loading">Checking your alerts…</div>}
        {error && <div className="premium-error">{error}</div>}
        {!loading && rules.length === 0 && <p className="alert-empty">No custom alerts yet. Create one above.</p>}
        <div className="rule-list">
          {rules.map(rule => (
            <div key={rule.id} className={`rule-card ${rule.triggered ? 'triggered' : ''}`}>
              <div className="rule-main">
                <span className="rule-title">{metricLabel(rule.metric)} {rule.operator} {rule.threshold}{rule.metric === 'rain_probability' ? '%' : ''}</span>
                <span className="rule-location">{rule.city}{rule.leadMinutes ? ` · ${rule.leadMinutes} min lead` : ''}</span>
                <span className="rule-status">
                  {rule.triggered ? '● Triggered' : rule.enabled ? '○ Watching' : '○ Paused'}
                </span>
              </div>
              {rule.reason && <p className="rule-reason">{rule.reason}</p>}
              <div className="rule-actions">
                <button onClick={() => toggle(rule)}>{rule.enabled ? 'Pause' : 'Resume'}</button>
                <button onClick={() => remove(rule.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {notifications.length > 0 && (
        <div className="glass-panel alerts-section">
          <div className="section-title">Recent Notifications</div>
          <div className="notification-list">
            {notifications.slice(0, 6).map(notification => (
              <div key={notification.id} className="notification-item">
                <span className="notification-icon">⚠️</span>
                <div>
                  <strong>{notification.city}</strong>
                  <p>{notification.message}</p>
                  <span className="notification-meta">{new Date(notification.createdAt).toLocaleString()} · {notification.channels.join(', ')}</span>
                  {notification.delivery && Object.keys(notification.delivery).length > 0 && (
                    <span className="notification-delivery">
                      {Object.entries(notification.delivery).map(([provider, status]) => `${provider}: ${status}`).join(' · ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
