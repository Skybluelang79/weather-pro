import { describe, expect, it } from 'vitest';
import { hasFeature, maxFavorites, maxForecastDays, maxHistory, formatNaira, mergePlanCatalog } from '../services/plans';
import type { Plan } from '../types';

describe('subscription entitlements', () => {
  it('keeps the free plan on basic features', () => {
    expect(hasFeature('free', 'extendedForecast')).toBe(false);
    expect(hasFeature('free', 'aiAssistant')).toBe(false);
    expect(hasFeature('free', 'weatherMaps')).toBe(false);
    expect(maxForecastDays('free')).toBe(3);
    expect(maxFavorites('free')).toBe(3);
    expect(maxHistory('free')).toBe(5);
  });

  it('unlocks pro features without climate analytics', () => {
    expect(hasFeature('pro', 'aiAssistant')).toBe(true);
    expect(hasFeature('pro', 'customAlerts')).toBe(true);
    expect(hasFeature('pro', 'weatherMaps')).toBe(true);
    expect(hasFeature('pro', 'climateAnalytics')).toBe(false);
    expect(maxForecastDays('pro')).toBe(14);
    expect(maxFavorites('pro')).toBe(Infinity);
    expect(maxHistory('pro')).toBe(Infinity);
    expect(hasFeature('pro', 'priorityAlerts')).toBe(false);
  });

  it('adds the 30-day outlook and priority checks for premium', () => {
    expect(hasFeature('premium', 'climateAnalytics')).toBe(true);
    expect(hasFeature('premium', 'priorityAlerts')).toBe(true);
    expect(maxForecastDays('premium')).toBe(30);
  });

  it('formats naira prices', () => {
    expect(formatNaira(2500)).toBe('₦2,500');
    expect(formatNaira(0)).toBe('₦0');
  });

  it('fills missing catalog details from local defaults', () => {
    const merged = mergePlanCatalog([
      { id: 'pro', name: 'Weather Pro', price: 2500, currency: 'NGN' } as Plan,
    ]);
    expect(merged[0].tagline).toBe('Serious planning, finer detail');
    expect(merged[0].featured).toBe(true);
    expect(merged[0].features).toContain('AI weather assistant');
  });
});
