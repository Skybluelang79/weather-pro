import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { FEATURE_PLAN, PLAN_RANK } from './plans.js';

export { FEATURE_PLAN, PLAN_RANK };

export const SESSION_COOKIE = 'weatherpro_sid';
export const USER_COOKIE = 'weatherpro_user';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
const FREE_SUBSCRIPTION = { plan: 'free', status: 'active', source: 'free', since: null, expiresAt: null };

function sessionSecret() {
  const secret = process.env.SESSION_SECRET || process.env.PAYSTACK_SECRET_KEY || 'weatherpro-local-session-secret';
  const production = process.env.NODE_ENV === 'production' || process.env.NETLIFY === 'true';
  if (production && secret === 'weatherpro-local-session-secret') {
    throw new Error('SESSION_SECRET must be set in production');
  }
  return secret;
}

export function createSubscriberId() {
  return `sub_${Date.now().toString(36)}_${randomBytes(8).toString('hex')}`;
}

export function createUserId() {
  return `usr_${Date.now().toString(36)}_${randomBytes(8).toString('hex')}`;
}

function signValue(value) {
  const text = String(value);
  const signature = createHmac('sha256', sessionSecret()).update(text).digest('base64url');
  return `${text}.${signature}`;
}

function verifySignedValue(token) {
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

export function signSubscriberId(id) {
  return signValue(id);
}

export function verifySignedSubscriberId(token) {
  const id = verifySignedValue(token);
  return id?.startsWith('sub_') ? id : null;
}

export function signUserId(id) {
  return signValue(id);
}

export function verifySignedUserId(token) {
  const id = verifySignedValue(token);
  return id?.startsWith('usr_') ? id : null;
}

function readCookie(req, name) {
  const header = req?.headers?.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function cookieFlags(maxAge) {
  const secure = process.env.NODE_ENV === 'production' || process.env.NETLIFY === 'true' ? '; Secure' : '';
  return `Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function setAuthCookies(res, subscriberId, userId) {
  res.removeHeader('Set-Cookie');
  const cookies = [
    `${SESSION_COOKIE}=${encodeURIComponent(signSubscriberId(subscriberId))}; ${cookieFlags(COOKIE_MAX_AGE)}`,
  ];
  if (userId) {
    cookies.push(`${USER_COOKIE}=${encodeURIComponent(signUserId(userId))}; ${cookieFlags(COOKIE_MAX_AGE)}`);
  }
  res.setHeader('Set-Cookie', cookies);
}

export function clearAuthCookies(res) {
  res.removeHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=; ${cookieFlags(0)}`,
    `${USER_COOKIE}=; ${cookieFlags(0)}`,
  ]);
}

export function sessionMiddleware(req, res, next) {
  const existing = verifySignedSubscriberId(readCookie(req, SESSION_COOKIE));
  if (existing) {
    req.subscriberId = existing;
    req.userId = verifySignedUserId(readCookie(req, USER_COOKIE));
    next();
    return;
  }

  const id = createSubscriberId();
  req.subscriberId = id;
  req.userId = verifySignedUserId(readCookie(req, USER_COOKIE));
  res.append('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(signSubscriberId(id))}; ${cookieFlags(COOKIE_MAX_AGE)}`);
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
  return hasEntitlement(subscription, 'weatherHistory') ? Infinity : 5;
}

export function maxForecastDaysFor(subscription) {
  const plan = activeSubscription(subscription).plan || 'free';
  if (plan === 'premium') return 30;
  if (plan === 'pro') return 14;
  return 3;
}
