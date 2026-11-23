import { describe, expect, it } from 'vitest';
import { hasFeature, maxFavorites, maxForecastDays, maxHistory, formatNaira } from '../services/plans';

describe('subscription entitlements', () => {
  it('keeps the free plan on basic features', () => {
    expect(hasFeature('free', 'extendedForecast')).toBe(false);
    expect(hasFeature('free', 'aiAssistant')).toBe(false);
    expect(maxForecastDays('free')).toBe(3);
    expect(maxFavorites('free')).toBe(3);
    expect(maxHistory('free')).toBe(5);
  });

  it('unlocks pro features without climate analytics', () => {
    expect(hasFeature('pro', 'aiAssistant')).toBe(true);
    expect(hasFeature('pro', 'customAlerts')).toBe(true);
    expect(hasFeature('pro', 'climateAnalytics')).toBe(false);
    expect(maxForecastDays('pro')).toBe(14);
    expect(maxFavorites('pro')).toBe(Infinity);
  });

  it('adds the 30-day outlook for premium', () => {
    expect(hasFeature('premium', 'climateAnalytics')).toBe(true);
    expect(maxForecastDays('premium')).toBe(30);
  });

  it('formats naira prices', () => {
    expect(formatNaira(2500)).toBe('₦2,500');
    expect(formatNaira(0)).toBe('₦0');
  });
});
