import { useEffect, useState } from 'react';
import { useAuth } from '../context/auth';
import { useSubscription } from '../context/subscription';
import { useToast } from './Toast';
import { formatNaira, PLANS } from '../services/plans';
import type { PlanId } from '../types';

const SOURCE_LABELS: Record<string, string> = {
  free: 'Free access',
  demo: 'Demo preview',
  paystack: 'Paid subscription',
};

export default function Pricing() {
  const { user } = useAuth();
  const {
    subscription, plan, plans, paymentsConfigured, demoUpgradesEnabled, subscriptionError,
    selectDemoPlan, manageSubscription, checkout, refresh,
  } = useSubscription();
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const catalog = plans.length ? plans : PLANS;
  const currentPlan = catalog.find(item => item.id === plan);
  const paidSubscription = subscription.source === 'paystack' && subscription.status === 'active';

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  const switchDemo = async (nextPlan: PlanId) => {
    setBusy(`demo:${nextPlan}`);
    try {
      await selectDemoPlan(nextPlan);
      addToast(`${catalog.find(p => p.id === nextPlan)?.name || 'Plan'} enabled in demo mode`, 'success');
    } catch (err) {
      addToast((err as Error).message || 'Could not switch plan', 'error');
    } finally {
      setBusy(null);
    }
  };

  const pay = async (nextPlan: PlanId) => {
    if (!email.trim()) {
      addToast('Enter your email address first', 'error');
      return;
    }
    setBusy(`pay:${nextPlan}`);
    try {
      await checkout(nextPlan, email.trim());
    } catch (err) {
      addToast((err as Error).message || 'Could not start checkout', 'error');
      setBusy(null);
    }
  };

  const manage = async (action: 'cancel' | 'downgrade') => {
    setBusy(`manage:${action}`);
    try {
      await manageSubscription(action);
      await refresh();
      addToast(action === 'cancel' ? 'Subscription cancelled' : 'Switched to the Basic plan', 'info');
    } catch (err) {
      addToast((err as Error).message || 'Could not update subscription', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="pricing animate-slide-up">
      <div className="pricing-header glass-panel">
        <div>
          <div className="section-title">Subscription Plans</div>
          <p className="premium-subtitle">
            Current plan: <strong>{currentPlan?.name || 'Weather Basic'}</strong>
            {' · '}{SOURCE_LABELS[subscription.status === 'cancelled' ? 'free' : subscription.source] || 'Free access'}
          </p>
        </div>
        <button className="refresh-btn" onClick={() => refresh()} disabled={busy !== null}>Refresh status</button>
      </div>

      {subscriptionError && (
        <div className="subscription-error" role="alert">
          <span>{subscriptionError}</span>
          <button onClick={() => refresh()}>Retry</button>
        </div>
      )}

      {paidSubscription && (
        <div className="subscription-status glass-panel">
          <div>
            <strong>{currentPlan?.name || 'Your plan'} is active</strong>
            <p className="premium-subtitle">
              {subscription.expiresAt
                ? `Access expires ${new Date(subscription.expiresAt).toLocaleDateString()} · ${subscription.daysRemaining ?? 0} days remaining`
                : 'Active without an expiry date'}
            </p>
          </div>
          <div className="subscription-actions">
            <button className="plan-pay-btn" onClick={() => pay(plan)} disabled={busy !== null}>
              {busy === `pay:${plan}` ? 'Opening checkout…' : 'Renew 30 days'}
            </button>
            <button className="plan-manage-btn" onClick={() => manage('cancel')} disabled={busy !== null}>Cancel</button>
            <button className="plan-manage-btn" onClick={() => manage('downgrade')} disabled={busy !== null}>Switch to Basic</button>
          </div>
        </div>
      )}

      {paymentsConfigured && (
        <div className="checkout-strip glass-panel">
          <span>Paystack checkout email</span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Checkout email"
          />
        </div>
      )}

      <div className="plan-grid">
        {catalog.map(item => {
          const current = item.id === plan;
          return (
            <div key={item.id} className={`plan-card glass-panel ${item.featured ? 'featured' : ''} ${current ? 'current' : ''}`}>
              {item.featured && <div className="plan-popular">POPULAR</div>}
              {current && <div className="plan-current">CURRENT PLAN</div>}
              <h3>{item.name}</h3>
              <div className="plan-price">
                {formatNaira(item.price)}<span> / 30 days</span>
              </div>
              <p className="plan-tagline">{item.tagline}</p>
              <ul className="plan-features">
                {item.features.map(feature => (
                  <li key={feature}><span>✓</span> {feature}</li>
                ))}
              </ul>
              <div className="plan-actions">
                {demoUpgradesEnabled && !current && (
                  <button className="plan-demo-btn" onClick={() => switchDemo(item.id)} disabled={busy !== null}>
                    {busy === `demo:${item.id}` ? 'Switching…' : `Preview ${item.name.split(' ').pop()}`}
                  </button>
                )}
                {paymentsConfigured && !current && item.id !== 'free' && (
                  <button className="plan-pay-btn" onClick={() => pay(item.id)} disabled={busy !== null}>
                    {busy === `pay:${item.id}` ? 'Opening…' : 'Subscribe'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pricing-note">
        {paymentsConfigured
          ? 'Paystack subscriptions unlock 30 days of access. Renew before expiry to keep Pro or Intelligence features; webhooks activate payments even if you close this tab.'
          : `Connect Paystack with PAYSTACK_SECRET_KEY to accept real payments. ${demoUpgradesEnabled ? 'Demo previews are available meanwhile.' : 'Demo previews are disabled.'}`}
      </div>
    </section>
  );
}
