import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = 'weatherpro_sid';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
const FREE_SUBSCRIPTION = { plan: 'free', status: 'active', source: 'free', since: null, expiresAt: null };

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
  adFree: 'pro',
  multiCityCompare: 'pro',
  climateAnalytics: 'premium',
};

function sessionSecret() {
  return process.env.SESSION_SECRET || process.env.PAYSTACK_SECRET_KEY || 'weatherpro-local-session-secret';
}

export function createSubscriberId() {
  return `sub_${Date.now().toString(36)}_${randomBytes(8).toString('hex')}`;
}

export function signSubscriberId(id) {
  const value = String(id);
  const signature = createHmac('sha256', sessionSecret()).update(value).digest('base64url');
  return `${value}.${signature}`;
}

export function verifySignedSubscriberId(token) {
  if (typeof token !== 'string' || !token) return null;
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const id = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!id || !signature) return null;

  const expected = createHmac('sha256', sessionSecret()).update(id).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  return timingSafeEqual(actualBuffer, expectedBuffer) ? id : null;
}

function readCookie(req, name) {
  const header = req?.headers?.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

export function sessionMiddleware(req, res, next) {
  const existing = verifySignedSubscriberId(readCookie(req, SESSION_COOKIE));
  if (existing) {
    req.subscriberId = existing;
    next();
    return;
  }

  const id = createSubscriberId();
  req.subscriberId = id;
  const secure = process.env.NODE_ENV === 'production' || process.env.NETLIFY === 'true' ? '; Secure' : '';
  res.append('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(signSubscriberId(id))}; Max-Age=${COOKIE_MAX_AGE}; Path=/; HttpOnly; SameSite=Lax${secure}`);
  next();
}

export function activeSubscription(subscription) {
  if (!subscription || (subscription.status && subscription.status !== 'active')) return FREE_SUBSCRIPTION;
  if (subscription.expiresAt && Date.now() > subscription.expiresAt) return FREE_SUBSCRIPTION;
  return subscription;
}

export function hasEntitlement(subscription, feature) {
  const plan = activeSubscription(subscription).plan || 'free';
  const required = FEATURE_PLAN[feature];
  if (!required) return true;
  return (PLAN_RANK[plan] || 0) >= (PLAN_RANK[required] || 0);
}

export function maxFavoritesFor(subscription) {
  return hasEntitlement(subscription, 'unlimitedLocations') ? Infinity : 3;
}

export function maxHistoryFor(subscription) {
  return hasEntitlement(subscription, 'weatherHistory') ? 20 : 5;
}

export function maxForecastDaysFor(subscription) {
  const plan = activeSubscription(subscription).plan || 'free';
  if (plan === 'premium') return 30;
  if (plan === 'pro') return 14;
  return 3;
}
