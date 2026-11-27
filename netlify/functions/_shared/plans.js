export const PLAN_RANK = { free: 0, pro: 1, premium: 2 };

export const FEATURE_PLAN = {
  extendedForecast: 'pro',
  hourlyRain: 'pro',
  windIntelligence: 'pro',
  weatherMaps: 'pro',
  aiAssistant: 'pro',
  customAlerts: 'pro',
  unlimitedLocations: 'pro',
  weatherHistory: 'pro',
  multiCityCompare: 'pro',
  climateAnalytics: 'premium',
  priorityAlerts: 'premium',
};

export const BILLING_DAYS = 30;

export const PLANS = {
  free: {
    id: 'free',
    name: 'Weather Basic',
    price: 0,
    currency: 'NGN',
    tagline: 'Everything you need for today',
    interval: 'month',
    featured: false,
    features: [
      'Current conditions',
      '24-hour forecast',
      '3-day outlook',
      'Standard weather alerts',
      'Up to 3 saved locations',
    ],
    limits: { forecastDays: 3, favorites: 3, history: 5 },
    featureKeys: [],
  },
  pro: {
    id: 'pro',
    name: 'Weather Pro',
    price: 2500,
    currency: 'NGN',
    tagline: 'Serious planning, finer detail',
    interval: 'month',
    featured: true,
    features: [
      'Everything in Basic',
      '14-day forecast',
      'Hourly rainfall predictions',
      'Wind intelligence',
      'Advanced radar & map layers',
      'AI weather assistant',
      'Unlimited saved locations',
      'Custom alerts with scheduled delivery',
      'Extended search history',
      'Multi-city comparison',
    ],
    limits: { forecastDays: 14, favorites: null, history: null },
    featureKeys: [
      'extendedForecast', 'hourlyRain', 'windIntelligence', 'weatherMaps', 'aiAssistant',
      'customAlerts', 'unlimitedLocations', 'weatherHistory', 'multiCityCompare',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Weather Intelligence',
    price: 5000,
    currency: 'NGN',
    tagline: 'Long-range insight and deeper analytics',
    interval: 'month',
    featured: false,
    features: [
      'Everything in Pro',
      '30-day climate outlook',
      'Extended climate analytics',
      'Hourly background alert checks',
      'Long-range confidence indicators',
    ],
    limits: { forecastDays: 30, favorites: null, history: null },
    featureKeys: [
      'extendedForecast', 'hourlyRain', 'windIntelligence', 'weatherMaps', 'aiAssistant',
      'customAlerts', 'unlimitedLocations', 'weatherHistory', 'multiCityCompare',
      'climateAnalytics', 'priorityAlerts',
    ],
  },
};

export const PLAN_IDS = Object.keys(PLANS);

export function getPlan(id) {
  return PLANS[id] || PLANS.free;
}
