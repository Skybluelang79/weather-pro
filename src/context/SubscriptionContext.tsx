import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import {
  hasFeature as checkFeature,
  maxFavorites as favoritesLimit,
  maxForecastDays as forecastLimit,
  maxHistory as historyLimit,
  mergePlanCatalog,
} from '../services/plans';
import { SubscriptionContext } from './subscription';
import type { SubscriptionContextValue } from './subscription';
import { useAuth } from './auth';
import type { Subscription } from '../types';

const FREE_SUBSCRIPTION: Subscription = { plan: 'free', status: 'active', source: 'free', since: null };

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription>(FREE_SUBSCRIPTION);
  const [plans, setPlans] = useState<SubscriptionContextValue['plans']>([]);
  const [paymentsConfigured, setPaymentsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  const refresh = useCallback(async () => {
    try {
      const [sub, catalog] = await Promise.all([api.getSubscription(), api.getPlans()]);
      setSubscription(sub);
      setPlans(mergePlanCatalog(catalog.plans));
      setPaymentsConfigured(catalog.paymentsConfigured);
    } catch {
      setSubscription(FREE_SUBSCRIPTION);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || (params.get('billing') === 'verify' ? sessionStorage.getItem('weatherpro-payment-ref') : null);

    (async () => {
      await refresh();
      if (!reference) return;
      try {
        const result = await api.verifyBilling(reference);
        if (active && result.success) setSubscription(result.subscription);
      } catch {
      } finally {
        sessionStorage.removeItem('weatherpro-payment-ref');
      }
    })();

    return () => { active = false; };
  }, [refresh, user?.id, authLoading]);

  const selectDemoPlan = useCallback(async (nextPlan: Subscription['plan']) => {
    const updated = await api.setDemoPlan(nextPlan);
    setSubscription(updated);
  }, []);

  const checkout = useCallback(async (nextPlan: Subscription['plan'], email: string) => {
    const result = await api.startCheckout(nextPlan, email);
    sessionStorage.setItem('weatherpro-payment-ref', result.reference);
    window.location.assign(result.authorizationUrl);
  }, []);

  const value = useMemo<SubscriptionContextValue>(() => ({
    subscription,
    plan: subscription.plan || 'free',
    plans,
    paymentsConfigured,
    loading,
    hasFeature: feature => checkFeature(subscription.plan || 'free', feature),
    maxForecastDays: forecastLimit(subscription.plan || 'free'),
    maxFavorites: favoritesLimit(subscription.plan || 'free'),
    maxHistory: historyLimit(subscription.plan || 'free'),
    selectDemoPlan,
    checkout,
    refresh,
  }), [subscription, plans, paymentsConfigured, loading, selectDemoPlan, checkout, refresh]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}
