import { useState } from 'react';
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
  const { subscription, plan, plans, paymentsConfigured, selectDemoPlan, checkout, refresh } = useSubscription();
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<PlanId | null>(null);

  const catalog = plans.length ? plans : PLANS;

  const switchDemo = async (nextPlan: PlanId) => {
    setBusy(nextPlan);
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
    setBusy(nextPlan);
    try {
      await checkout(nextPlan, email.trim());
    } catch (err) {
      addToast((err as Error).message || 'Could not start checkout', 'error');
      setBusy(null);
    }
  };

  return (
    <section className="pricing animate-slide-up">
      <div className="pricing-header glass-panel">
        <div>
          <div className="section-title">Subscription Plans</div>
          <p className="premium-subtitle">
            Current plan: <strong>{catalog.find(p => p.id === plan)?.name || 'Weather Basic'}</strong>
            {' · '}{SOURCE_LABELS[subscription.source] || 'Free access'}
          </p>
        </div>
        <button className="refresh-btn" onClick={() => refresh()}>Refresh status</button>
      </div>

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
                {formatNaira(item.price)}<span> / month</span>
              </div>
              <p className="plan-tagline">{item.tagline}</p>
              <ul className="plan-features">
                {item.features.map(feature => (
                  <li key={feature}><span>✓</span> {feature}</li>
                ))}
              </ul>
              <div className="plan-actions">
                {!current && (
                  <button className="plan-demo-btn" onClick={() => switchDemo(item.id)} disabled={busy === item.id}>
                    {busy === item.id ? 'Switching…' : `Preview ${item.name.split(' ').pop()}`}
                  </button>
                )}
                {paymentsConfigured && !current && item.id !== 'free' && (
                  <button className="plan-pay-btn" onClick={() => pay(item.id)} disabled={busy === item.id}>
                    Subscribe
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pricing-note">
        Demo previews are stored in this browser only. Connect Paystack with <code>PAYSTACK_SECRET_KEY</code> to accept
        real ₦ subscriptions; successful payments automatically unlock the purchased plan.
      </div>
    </section>
  );
}
