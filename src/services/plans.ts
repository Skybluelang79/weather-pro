import type { Plan, PlanId } from '../types';

export type PremiumFeature =
  | 'extendedForecast'
  | 'hourlyRain'
  | 'windIntelligence'
  | 'aiAssistant'
  | 'customAlerts'
  | 'unlimitedLocations'
  | 'weatherHistory'
  | 'climateAnalytics'
  | 'adFree'
  | 'multiCityCompare'
  | 'weatherMaps';

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Weather Basic',
    price: 0,
    currency: 'NGN',
    tagline: 'Everything you need for today',
    features: [
      'Current conditions',
      'Basic 24-hour forecast',
      '3-day outlook',
      'Standard weather alerts',
      'Up to 3 saved locations',
    ],
  },
  {
    id: 'pro',
    name: 'Weather Pro',
    price: 2500,
    currency: 'NGN',
    tagline: 'Serious planning, finer detail',
    featured: true,
    features: [
      'Everything in Basic',
      '14-day forecast',
      'Hourly rainfall predictions',
      'Wind intelligence',
      'Advanced radar & map layers',
      'AI weather assistant',
      'Unlimited saved locations',
      'Personalized custom alerts',
      'Full weather history',
      'No advertisements',
    ],
  },
  {
    id: 'premium',
    name: 'Weather Intelligence',
    price: 5000,
    currency: 'NGN',
    tagline: 'Long-range insight and deeper analytics',
    features: [
      'Everything in Pro',
      '30-day climate outlook',
      'Extended climate analytics',
      'Lower-confidence long-range trends',
      'Priority alert delivery',
      'Advanced weather intelligence',
    ],
  },
];

const FEATURE_MATRIX: Record<PlanId, PremiumFeature[]> = {
  free: [],
  pro: [
    'extendedForecast',
    'hourlyRain',
    'windIntelligence',
    'weatherMaps',
    'aiAssistant',
    'customAlerts',
    'unlimitedLocations',
    'weatherHistory',
    'adFree',
    'multiCityCompare',
  ],
  premium: [
    'extendedForecast',
    'hourlyRain',
    'windIntelligence',
    'weatherMaps',
    'aiAssistant',
    'customAlerts',
    'unlimitedLocations',
    'weatherHistory',
    'climateAnalytics',
    'adFree',
    'multiCityCompare',
  ],
};

export function hasFeature(plan: PlanId, feature: PremiumFeature): boolean {
  return FEATURE_MATRIX[plan]?.includes(feature) ?? false;
}

export function maxForecastDays(plan: PlanId): number {
  if (plan === 'premium') return 30;
  if (plan === 'pro') return 14;
  return 3;
}

export function maxFavorites(plan: PlanId): number {
  return hasFeature(plan, 'unlimitedLocations') ? Infinity : 3;
}

export function maxHistory(plan: PlanId): number {
  return hasFeature(plan, 'weatherHistory') ? Infinity : 5;
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

export function mergePlanCatalog(serverPlans: Plan[]): Plan[] {
  return serverPlans.map(plan => {
    const defaults = PLANS.find(item => item.id === plan.id);
    return {
      ...plan,
      tagline: plan.tagline || defaults?.tagline || '',
      featured: plan.featured ?? defaults?.featured,
      features: plan.features?.length ? plan.features : defaults?.features || [],
    };
  });
}
