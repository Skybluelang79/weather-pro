import { createContext, useContext } from 'react';
import type { PremiumFeature } from '../services/plans';
import type { Plan, PlanId, Subscription } from '../types';

export interface SubscriptionContextValue {
  subscription: Subscription;
  plan: PlanId;
  plans: Plan[];
  paymentsConfigured: boolean;
  loading: boolean;
  hasFeature: (feature: PremiumFeature) => boolean;
  maxForecastDays: number;
  maxFavorites: number;
  maxHistory: number;
  selectDemoPlan: (plan: PlanId) => Promise<void>;
  checkout: (plan: PlanId, email: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
