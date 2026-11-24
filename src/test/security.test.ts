import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSubscriberId,
  signSubscriberId,
  verifySignedSubscriberId,
  activeSubscription,
  hasEntitlement,
  maxFavoritesFor,
  maxHistoryFor,
  maxForecastDaysFor,
} from '../../netlify/functions/_shared/security.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('subscriber sessions', () => {
  it('signs and verifies a subscriber id', () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    const id = createSubscriberId();
    const token = signSubscriberId(id);
    expect(verifySignedSubscriberId(token)).toBe(id);
  });

  it('rejects tampered tokens', () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    const token = signSubscriberId('sub_123');
    expect(verifySignedSubscriberId(`${token}x`)).toBeNull();
    expect(verifySignedSubscriberId('sub_123.forged')).toBeNull();
    expect(verifySignedSubscriberId('malformed')).toBeNull();
  });
});

describe('subscription entitlements', () => {
  const free = { plan: 'free', status: 'active', source: 'free', since: null, expiresAt: null };
  const pro = { plan: 'pro', status: 'active', source: 'paystack', since: 1, expiresAt: null };
  const premium = { plan: 'premium', status: 'active', source: 'paystack', since: 1, expiresAt: null };

  it('gates Pro features for free users', () => {
    expect(hasEntitlement(free, 'extendedForecast')).toBe(false);
    expect(hasEntitlement(free, 'weatherMaps')).toBe(false);
    expect(hasEntitlement(free, 'aiAssistant')).toBe(false);
    expect(hasEntitlement(free, 'customAlerts')).toBe(false);
    expect(hasEntitlement(free, 'multiCityCompare')).toBe(false);
  });

  it('grants Pro features and plan limits to Pro and Premium', () => {
    for (const plan of [pro, premium]) {
      expect(hasEntitlement(plan, 'extendedForecast')).toBe(true);
      expect(hasEntitlement(plan, 'weatherMaps')).toBe(true);
      expect(hasEntitlement(plan, 'aiAssistant')).toBe(true);
      expect(hasEntitlement(plan, 'customAlerts')).toBe(true);
      expect(maxFavoritesFor(plan)).toBe(Infinity);
      expect(maxHistoryFor(plan)).toBe(20);
    }
    expect(maxForecastDaysFor(pro)).toBe(14);
    expect(maxForecastDaysFor(premium)).toBe(30);
    expect(hasEntitlement(pro, 'climateAnalytics')).toBe(false);
    expect(hasEntitlement(premium, 'climateAnalytics')).toBe(true);
  });

  it('falls back to free for expired subscriptions', () => {
    const expired = { ...pro, expiresAt: Date.now() - 1 };
    expect(activeSubscription(expired).plan).toBe('free');
    expect(hasEntitlement(expired, 'extendedForecast')).toBe(false);
    expect(maxFavoritesFor(expired)).toBe(3);
  });
});
