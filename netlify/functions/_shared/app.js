import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import fetch from 'node-fetch';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { sendNotification, setVapidDetails } from 'web-push';
import { loadData, saveData } from './storage.js';
import { generateAIAnswer, evaluateRule, weatherCodeInfo, DISCLAIMER } from './intelligence.js';
import { PLANS, PLAN_IDS, getPlan } from './plans.js';
import {
  sessionMiddleware,
  setAuthCookies,
  clearAuthCookies,
  createUserId,
  createSubscriberId,
  activeSubscription,
  hasEntitlement,
  maxFavoritesFor,
  maxForecastDaysFor,
  maxHistoryFor,
} from './security.js';

config();

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN
  || (process.env.NETLIFY === 'true' ? 'https://myweatherreportapp.netlify.app' : 'http://localhost:5174');
const DEMO_UPGRADES_ENABLED = process.env.ALLOW_DEMO_UPGRADES === 'true' || !process.env.PAYSTACK_SECRET_KEY;
const DEMO_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ALERT_CHANNELS = ['in-app', 'email', 'sms', 'webhook', 'push'];
const PUSH_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.apple.com'];

const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS) || 0;
const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE = 'https://api.openweathermap.org/data/2.5';
const GEO_BASE = 'https://api.openweathermap.org/geo/1.0';
const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const OPEN_METEO_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const PAYSTACK_BASE = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const RAINVIEWER_MAPS = 'https://api.rainviewer.com/public/weather-maps.json';
const OWM_MAP_BASE = 'https://tile.openweathermap.org/map';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM || 'WeatherPro <alerts@weatherpro.app>';
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
const ALERT_SMS_TO = process.env.ALERT_SMS_TO;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
const NOTIFICATION_WEBHOOK_URL = process.env.NOTIFICATION_WEBHOOK_URL;

const DEFAULT_TTL = {
  weather: 10 * 60 * 1000,
  forecast: 30 * 60 * 1000,
  air: 60 * 60 * 1000,
  geocode: 24 * 60 * 60 * 1000,
  premium: 60 * 60 * 1000,
};

if (CACHE_TTL_MS > 0) {
  for (const key of Object.keys(DEFAULT_TTL)) DEFAULT_TTL[key] = CACHE_TTL_MS;
}

const fetchCache = new Map();
const tileCache = new Map();

function cacheGet(key) {
  const hit = fetchCache.get(key);
  if (!hit) return null;
  if (hit.expires > Date.now()) return hit.value;
  fetchCache.delete(key);
  return null;
}

function cacheSet(key, value, ttl) {
  if (fetchCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of fetchCache) {
      if (v.expires <= now) fetchCache.delete(k);
    }
  }
  fetchCache.set(key, { value, expires: Date.now() + (ttl || DEFAULT_TTL.geocode) });
}

async function fetchJson(url, { ttl, headers } = {}) {
  const cached = cacheGet(url);
  if (cached !== null) return cached;
  const r = await fetch(url, headers ? { headers } : undefined);
  if (!r.ok) {
    const err = await r.json().catch(() => ({ message: `HTTP ${r.status}` }));
    const e = new Error(err.message || err.reason || `HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  const data = await r.json();
  cacheSet(url, data, ttl);
  return data;
}

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf.toString(); } }));

app.use((req, res, next) => {
  if (req.path.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '/api');
  }
  next();
});
app.use(sessionMiddleware);

const buckets = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60 * 1000;

function rateLimiter(req, res, next) {
  if (!req.path.startsWith('/api')) return next();
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const key = `${req.subscriberId || 'anonymous'}:${ip}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
    bucket = { windowStart: now, tokens: RATE_LIMIT - 1 };
    buckets.set(key, bucket);
    return next();
  }
  if (bucket.tokens <= 0) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }
  bucket.tokens--;
  next();
}

app.use(rateLimiter);

const favorites = [];
const searchHistory = [];
const alertRules = [];
const notifications = [];
const subscriptions = {};
const pushSubscriptions = [];
const processedEvents = new Set();
const users = [];
let initPromise = null;

function ensureInitialized() {
  if (!initPromise) {
    initPromise = loadData().then((data) => {
      favorites.push(...(data.favorites || []).map(record => ({ ...record, owner: record.owner || 'legacy' })));
      searchHistory.push(...(data.searchHistory || []).map(record => ({ ...record, owner: record.owner || 'legacy' })));
      alertRules.push(...(data.alertRules || []).map(record => ({ ...record, owner: record.owner || 'legacy' })));
      notifications.push(...(data.notifications || []).map(record => ({ ...record, owner: record.owner || 'legacy' })));
      pushSubscriptions.push(...(data.pushSubscriptions || []).map(record => ({ ...record, owner: record.owner || 'legacy' })));
      Object.assign(subscriptions, data.subscriptions || {});
      users.push(...(data.users || []));
      for (const id of data.processedEvents || []) processedEvents.add(String(id));
    }).catch((e) => console.error('Failed to load persisted state:', e.message));
  }
  return initPromise;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function persist() {
  await saveData({
    favorites,
    searchHistory,
    alertRules,
    notifications,
    subscriptions,
    pushSubscriptions,
    processedEvents: [...processedEvents],
    users,
  });
}

function subscriberFrom(req) {
  return req.subscriberId || 'anonymous';
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}

function passwordMatches(password, user) {
  const expected = Buffer.from(user.passwordHash || '', 'hex');
  const actual = Buffer.from(hashPassword(password, user.salt).hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

function owned(collection, owner) {
  return collection.filter(record => record.owner === owner);
}

function findOwned(collection, id, owner) {
  return collection.find(record => record.id === id && record.owner === owner);
}

function currentSubscription(owner) {
  return activeSubscription(subscriptions[owner]);
}

function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      await ensureInitialized();
      if (!hasEntitlement(currentSubscription(req.subscriberId), feature)) {
        return res.status(403).json({
          error: 'This feature requires a Pro plan.',
          code: 'UPGRADE_REQUIRED',
        });
      }
      next();
    } catch {
      return res.status(500).json({ error: 'Could not verify subscription' });
    }
  };
}

function normalizeUnits(units) {
  return units === 'imperial' ? 'imperial' : 'metric';
}

function validCoord(lat, lon) {
  const a = Number(lat);
  const b = Number(lon);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180;
}

function coordsFromQuery(query) {
  const lat = Number(query.lat);
  const lon = Number(query.lon);
  return validCoord(lat, lon) ? { lat, lon } : null;
}

function clampLimit(value, fallback, max = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

async function resolveLocation({ city, lat, lon }) {
  if (validCoord(lat, lon)) {
    return { lat: Number(lat), lon: Number(lon), name: 'Selected location', country: '', timezone: 'auto' };
  }
  if (!city) {
    const e = new Error('Provide city or lat/lon');
    e.status = 400;
    throw e;
  }
  const url = `${OPEN_METEO_GEO}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const data = await fetchJson(url, { ttl: DEFAULT_TTL.geocode });
  const hit = data.results?.[0];
  if (!hit) {
    const e = new Error(`Location "${city}" was not found`);
    e.status = 404;
    throw e;
  }
  return {
    lat: hit.latitude,
    lon: hit.longitude,
    name: hit.name,
    country: hit.country || '',
    timezone: hit.timezone || 'auto',
  };
}

function addDays(dateString, count) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function lastYear(dateString) {
  const year = Number(dateString.slice(0, 4)) - 1;
  return `${year}${dateString.slice(4)}`;
}

function dayLabel(dateString) {
  return new Date(`${dateString}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

async function getPremiumForecastData({ lat, lon, days = 7, units = 'metric' }) {
  const unit = normalizeUnits(units);
  const imperial = unit === 'imperial';
  const requestDays = Math.max(1, Math.min(16, Number(days) || 7));
  const dailyFields = [
    'weather_code', 'temperature_2m_max', 'temperature_2m_min',
    'apparent_temperature_max', 'apparent_temperature_min',
    'precipitation_sum', 'precipitation_probability_max',
    'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant',
    'sunrise', 'sunset', 'uv_index_max',
  ].join(',');
  const hourlyFields = [
    'temperature_2m', 'apparent_temperature', 'precipitation_probability',
    'precipitation', 'weather_code', 'wind_speed_10m', 'wind_gusts_10m',
    'wind_direction_10m', 'relative_humidity_2m',
  ].join(',');
  const url = `${OPEN_METEO}?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=${requestDays}`
    + `&temperature_unit=${imperial ? 'fahrenheit' : 'celsius'}`
    + `&wind_speed_unit=${imperial ? 'mph' : 'kmh'}`
    + `&precipitation_unit=${imperial ? 'inch' : 'mm'}`
    + `&daily=${encodeURIComponent(dailyFields)}&hourly=${encodeURIComponent(hourlyFields)}`;
  const data = await fetchJson(url, { ttl: DEFAULT_TTL.premium });
  const d = data.daily || {};
  const h = data.hourly || {};

  const daily = (d.time || []).map((date, i) => {
    const code = d.weather_code?.[i] ?? 0;
    const info = weatherCodeInfo(code);
    return {
      date,
      dayLabel: i === 0 ? 'Today' : dayLabel(date),
      code,
      description: info.description,
      icon: info.icon,
      tempMax: d.temperature_2m_max?.[i] ?? 0,
      tempMin: d.temperature_2m_min?.[i] ?? 0,
      feelsMax: d.apparent_temperature_max?.[i] ?? 0,
      feelsMin: d.apparent_temperature_min?.[i] ?? 0,
      precipSum: d.precipitation_sum?.[i] ?? 0,
      precipProbability: d.precipitation_probability_max?.[i] ?? 0,
      windSpeed: d.wind_speed_10m_max?.[i] ?? 0,
      windGust: d.wind_gusts_10m_max?.[i] ?? 0,
      windDeg: d.wind_direction_10m_dominant?.[i] ?? 0,
      sunrise: d.sunrise?.[i] || '',
      sunset: d.sunset?.[i] || '',
      uvIndex: d.uv_index_max?.[i] ?? 0,
      confidence: 'high',
      source: 'forecast',
      modeled: false,
    };
  });

  const hourly = (h.time || []).slice(0, 48).map((time, i) => {
    const code = h.weather_code?.[i] ?? 0;
    const info = weatherCodeInfo(code);
    return {
      time,
      temp: h.temperature_2m?.[i] ?? 0,
      feelsLike: h.apparent_temperature?.[i] ?? 0,
      precipProbability: h.precipitation_probability?.[i] ?? 0,
      precip: h.precipitation?.[i] ?? 0,
      humidity: h.relative_humidity_2m?.[i] ?? 0,
      code,
      description: info.description,
      icon: info.icon,
      windSpeed: h.wind_speed_10m?.[i] ?? 0,
      windGust: h.wind_gusts_10m?.[i] ?? 0,
      windDeg: h.wind_direction_10m?.[i] ?? 0,
    };
  });

  const requested = Math.max(1, Math.min(30, Number(days) || 7));
  if (requested > 16 && daily.length) {
    const climateDays = requested - daily.length;
    const start = addDays(daily[daily.length - 1].date, 1);
    const end = addDays(start, climateDays - 1);
    const archiveFields = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum';
    const archiveUrl = `${OPEN_METEO_ARCHIVE}?latitude=${lat}&longitude=${lon}&timezone=auto`
      + `&start_date=${lastYear(start)}&end_date=${lastYear(end)}`
      + `&temperature_unit=${imperial ? 'fahrenheit' : 'celsius'}`
      + `&precipitation_unit=${imperial ? 'inch' : 'mm'}`
      + `&daily=${encodeURIComponent(archiveFields)}`;
    let archive = null;
    try {
      archive = await fetchJson(archiveUrl, { ttl: DEFAULT_TTL.premium });
    } catch {
      archive = null;
    }
    const times = archive?.daily?.time || [];
    for (let i = 0; i < climateDays; i++) {
      const date = addDays(start, i);
      const sourceIndex = times.indexOf(lastYear(date));
      const code = sourceIndex >= 0 ? (archive.daily.weather_code?.[sourceIndex] ?? 0) : daily[daily.length - 1].code;
      const info = weatherCodeInfo(code);
      const precipSum = sourceIndex >= 0 ? (archive.daily.precipitation_sum?.[sourceIndex] ?? 0) : 0;
      daily.push({
        date,
        dayLabel: dayLabel(date),
        code,
        description: info.description,
        icon: info.icon,
        tempMax: sourceIndex >= 0 ? (archive.daily.temperature_2m_max?.[sourceIndex] ?? 0) : daily[daily.length - 1].tempMax,
        tempMin: sourceIndex >= 0 ? (archive.daily.temperature_2m_min?.[sourceIndex] ?? 0) : daily[daily.length - 1].tempMin,
        feelsMax: sourceIndex >= 0 ? (archive.daily.temperature_2m_max?.[sourceIndex] ?? 0) : daily[daily.length - 1].feelsMax,
        feelsMin: sourceIndex >= 0 ? (archive.daily.temperature_2m_min?.[sourceIndex] ?? 0) : daily[daily.length - 1].feelsMin,
        precipSum,
        precipProbability: Math.min(100, Math.round(Number(precipSum) * (imperial ? 120 : 8))),
        windSpeed: daily[daily.length - 1].windSpeed,
        windGust: daily[daily.length - 1].windGust,
        windDeg: daily[daily.length - 1].windDeg,
        sunrise: '',
        sunset: '',
        uvIndex: 0,
        confidence: 'low',
        source: sourceIndex >= 0 ? 'climate' : 'projection',
        modeled: true,
      });
    }
  }

  return { daily, hourly, units: unit, generatedAt: Date.now() };
}

app.get('/api/weather/current', async (req, res) => {
  try {
    await ensureInitialized();
    const { city, units = 'metric' } = req.query;
    const coords = coordsFromQuery(req.query);
    let url;
    if (coords) {
      url = `${BASE}/weather?lat=${coords.lat}&lon=${coords.lon}&units=${normalizeUnits(units)}&appid=${API_KEY}`;
    } else if (city) {
      url = `${BASE}/weather?q=${encodeURIComponent(String(city))}&units=${normalizeUnits(units)}&appid=${API_KEY}`;
    } else {
      return res.status(400).json({ error: 'Provide city or valid lat/lon' });
    }
    const data = await fetchJson(url, { ttl: DEFAULT_TTL.weather });
    const code = Number(data.cod);
    if (code && code !== 200) {
      return res.status(code >= 400 && code < 600 ? code : 502).json({ error: 'Weather data unavailable' });
    }
    res.json(data);
  } catch {
    res.status(502).json({ error: 'Failed to fetch weather' });
  }
});

app.get('/api/weather/forecast', async (req, res) => {
  try {
    const { city, units = 'metric' } = req.query;
    const coords = coordsFromQuery(req.query);
    let url;
    if (coords) {
      url = `${BASE}/forecast?lat=${coords.lat}&lon=${coords.lon}&units=${normalizeUnits(units)}&appid=${API_KEY}`;
    } else if (city) {
      url = `${BASE}/forecast?q=${encodeURIComponent(String(city))}&units=${normalizeUnits(units)}&appid=${API_KEY}`;
    } else {
      return res.status(400).json({ error: 'Provide city or valid lat/lon' });
    }
    const data = await fetchJson(url, { ttl: DEFAULT_TTL.forecast });
    if (String(data.cod) !== '200') return res.status(502).json({ error: 'Forecast unavailable' });
    res.json(data);
  } catch {
    res.status(502).json({ error: 'Failed to fetch forecast' });
  }
});

app.get('/api/weather/air', async (req, res) => {
  try {
    const coords = coordsFromQuery(req.query);
    if (!coords) return res.status(400).json({ error: 'valid lat and lon required' });
    const url = `${BASE}/air_pollution?lat=${coords.lat}&lon=${coords.lon}&appid=${API_KEY}`;
    res.json(await fetchJson(url, { ttl: DEFAULT_TTL.air }));
  } catch {
    res.status(502).json({ error: 'Failed to fetch air quality' });
  }
});

app.get('/api/weather/alerts', async (req, res) => {
  try {
    const coords = coordsFromQuery(req.query);
    if (!coords) return res.status(400).json({ error: 'valid lat and lon required' });
    const headers = { 'User-Agent': 'WeatherPro/1.0', 'Accept': 'application/json' };
    const pointR = await fetch(`https://api.weather.gov/points/${coords.lat},${coords.lon}`, { headers });
    if (!pointR.ok) return res.status(502).json({ error: 'Weather alerts unavailable' });
    const r = await fetch(`https://api.weather.gov/alerts/point?lat=${coords.lat}&lon=${coords.lon}`, { headers });
    if (!r.ok) return res.status(502).json({ error: 'Weather alerts unavailable' });
    const data = await r.json();
    const alerts = (data.features || []).slice(0, 5).map(f => ({
      id: f.properties.id,
      event: f.properties.event,
      headline: f.properties.headline,
      severity: f.properties.severity,
      urgency: f.properties.urgency,
      description: f.properties.description,
      instruction: f.properties.instruction || '',
    }));
    return res.json({ alerts });
  } catch {
    return res.status(502).json({ error: 'Weather alerts unavailable' });
  }
});

app.get('/api/geocode', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'q required' });
    const limit = clampLimit(req.query.limit, 5);
    const url = `${GEO_BASE}/direct?q=${encodeURIComponent(String(q))}&limit=${limit}&appid=${API_KEY}`;
    res.json(await fetchJson(url, { ttl: DEFAULT_TTL.geocode }));
  } catch {
    res.status(502).json({ error: 'Failed to geocode' });
  }
});

app.get('/api/reverse-geocode', async (req, res) => {
  try {
    const coords = coordsFromQuery(req.query);
    if (!coords) return res.status(400).json({ error: 'valid lat and lon required' });
    const limit = clampLimit(req.query.limit, 1);
    const url = `${GEO_BASE}/reverse?lat=${coords.lat}&lon=${coords.lon}&limit=${limit}&appid=${API_KEY}`;
    res.json(await fetchJson(url, { ttl: DEFAULT_TTL.geocode }));
  } catch {
    res.status(502).json({ error: 'Failed to reverse geocode' });
  }
});

app.get('/api/favorites', async (req, res) => {
  await ensureInitialized();
  res.json(owned(favorites, req.subscriberId));
});

app.post('/api/favorites', async (req, res) => {
  await ensureInitialized();
  const { city, country, lat, lon } = req.body || {};
  if (typeof city !== 'string' || !city.trim()) return res.status(400).json({ error: 'city required' });
  const owner = req.subscriberId;
  const userFavorites = owned(favorites, owner);
  if (userFavorites.length >= maxFavoritesFor(currentSubscription(owner))) {
    return res.status(403).json({ error: 'Favorite limit reached for your plan.', code: 'UPGRADE_REQUIRED' });
  }
  if (userFavorites.some(f => f.city.toLowerCase() === city.toLowerCase())) {
    return res.status(409).json({ error: 'Already in favorites' });
  }
  const fav = { id: genId(), owner, city, country, lat, lon, addedAt: Date.now() };
  favorites.unshift(fav);
  await persist();
  res.json(fav);
});

app.delete('/api/favorites/:id', async (req, res) => {
  await ensureInitialized();
  const idx = favorites.findIndex(f => f.id === req.params.id && f.owner === req.subscriberId);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  favorites.splice(idx, 1);
  await persist();
  res.json({ success: true });
});

app.get('/api/history', async (req, res) => {
  await ensureInitialized();
  res.json(owned(searchHistory, req.subscriberId).slice(0, maxHistoryFor(currentSubscription(req.subscriberId))));
});

app.post('/api/history/record', async (req, res) => {
  try {
    await ensureInitialized();
    const { city, country } = req.body || {};
    if (typeof city !== 'string' || !city.trim()) return res.status(400).json({ error: 'city required' });
    const owner = req.subscriberId;
    const userHistory = owned(searchHistory, owner);
    const existing = userHistory.find(h => h.city.toLowerCase() === city.toLowerCase());
    if (existing) {
      existing.timestamp = Date.now();
      searchHistory.splice(searchHistory.indexOf(existing), 1);
      searchHistory.unshift(existing);
    } else {
      searchHistory.unshift({ id: genId(), owner, city, country, timestamp: Date.now() });
    }
    const limit = maxHistoryFor(currentSubscription(owner));
    for (const entry of owned(searchHistory, owner).slice(limit)) {
      searchHistory.splice(searchHistory.indexOf(entry), 1);
    }
    await persist();
    res.json({ success: true, searchHistory: owned(searchHistory, owner) });
  } catch {
    res.status(500).json({ error: 'Failed to record history' });
  }
});

app.delete('/api/history/:id', async (req, res) => {
  await ensureInitialized();
  const idx = searchHistory.findIndex(h => h.id === req.params.id && h.owner === req.subscriberId);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  searchHistory.splice(idx, 1);
  await persist();
  res.json({ success: true });
});

app.delete('/api/history', async (req, res) => {
  await ensureInitialized();
  for (const entry of owned(searchHistory, req.subscriberId)) {
    searchHistory.splice(searchHistory.indexOf(entry), 1);
  }
  await persist();
  res.json({ success: true });
});

app.get('/api/premium/forecast', requireFeature('extendedForecast'), async (req, res) => {
  try {
    const { city, lat, lon, days = 7, units = 'metric' } = req.query;
    const allowedDays = maxForecastDaysFor(currentSubscription(req.subscriberId));
    const requestedDays = Math.max(1, Math.min(allowedDays, Number(days) || 7));
    const location = await resolveLocation({ city, lat, lon });
    if (city) location.name = String(city);
    const forecast = await getPremiumForecastData({ lat: location.lat, lon: location.lon, days: requestedDays, units });
    res.json({
      location: {
        name: location.name,
        country: location.country,
        lat: location.lat,
        lon: location.lon,
        timezone: location.timezone,
      },
      ...forecast,
      disclaimer: DISCLAIMER,
    });
  } catch (err) {
    res.status(err.status && err.status < 600 ? err.status : 500).json({ error: 'Failed to load extended forecast' });
  }
});

const aiBuckets = new Map();
const AI_LIMIT = 20;
const AI_WINDOW_MS = 60 * 60 * 1000;

function aiLimiter(req, res, next) {
  const key = `${subscriberFrom(req)}:${req.ip || 'unknown'}`;
  const now = Date.now();
  let bucket = aiBuckets.get(key);
  if (!bucket || now - bucket.start >= AI_WINDOW_MS) {
    bucket = { start: now, count: 1 };
    aiBuckets.set(key, bucket);
    return next();
  }
  if (bucket.count >= AI_LIMIT) {
    return res.status(429).json({ error: 'AI question limit reached for this hour.' });
  }
  bucket.count++;
  next();
}

app.post('/api/ai/weather', requireFeature('aiAssistant'), aiLimiter, async (req, res) => {
  try {
    const { question = '', city, lat, lon, units = 'metric', days = 7 } = req.body || {};
    if (typeof question !== 'string') return res.status(400).json({ error: 'Question must be a string' });
    if (question.length > 600) return res.status(400).json({ error: 'Question is too long' });
    const allowedDays = maxForecastDaysFor(currentSubscription(req.subscriberId));
    const requestedDays = Math.max(1, Math.min(allowedDays, Number(days) || 7));
    const location = await resolveLocation({ city, lat, lon });
    if (city) location.name = String(city);
    const forecast = await getPremiumForecastData({ lat: location.lat, lon: location.lon, days: requestedDays, units });
    const result = await generateAIAnswer({
      question,
      location,
      daily: forecast.daily,
      hourly: forecast.hourly,
      units: forecast.units,
      fetchImpl: fetch,
    });
    res.json({ ...result, location: { name: location.name, country: location.country } });
  } catch (err) {
    res.status(err.status && err.status < 600 ? err.status : 500).json({ error: 'AI assistant unavailable' });
  }
});

function getSubscription(subscriberId) {
  return activeSubscription(subscriptions[subscriberId]);
}

function setSubscription(subscriberId, plan, source, ttlMs) {
  subscriptions[subscriberId] = {
    plan,
    status: 'active',
    source,
    since: Date.now(),
    expiresAt: ttlMs ? Date.now() + ttlMs : null,
  };
}

app.post('/api/auth/register', async (req, res) => {
  try {
    await ensureInitialized();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim().slice(0, 80);
    if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    if (users.some(user => user.email === email)) return res.status(409).json({ error: 'An account with that email already exists.' });

    const { salt, hash } = hashPassword(password);
    const user = {
      id: createUserId(),
      email,
      name: name || email.split('@')[0],
      salt,
      passwordHash: hash,
      subscriberId: createSubscriberId(),
      createdAt: Date.now(),
    };
    users.push(user);
    await persist();
    setAuthCookies(res, user.subscriberId, user.id);
    res.status(201).json({ user: publicUser(user), subscription: getSubscription(user.subscriberId) });
  } catch (err) {
    console.error('Registration failed:', err.message);
    res.status(500).json({ error: 'Could not create account.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    await ensureInitialized();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const user = users.find(record => record.email === email);
    if (!user || !passwordMatches(password, user)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    setAuthCookies(res, user.subscriberId, user.id);
    res.json({ user: publicUser(user), subscription: getSubscription(user.subscriberId) });
  } catch (err) {
    console.error('Login failed:', err.message);
    res.status(500).json({ error: 'Could not sign in.' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  clearAuthCookies(res);
  res.json({ success: true });
});

app.get('/api/auth/me', async (req, res) => {
  await ensureInitialized();
  const user = users.find(record => record.id === req.userId);
  res.json({
    user: user ? publicUser(user) : null,
    subscription: getSubscription(user?.subscriberId || subscriberFrom(req)),
  });
});

app.get('/api/plans', (_req, res) => {
  res.json({ plans: Object.values(PLANS), currency: 'NGN', paymentsConfigured: Boolean(PAYSTACK_SECRET_KEY) });
});

app.get('/api/subscription', async (req, res) => {
  await ensureInitialized();
  res.json(getSubscription(subscriberFrom(req)));
});

app.post('/api/subscription/demo', async (req, res) => {
  await ensureInitialized();
  if (!DEMO_UPGRADES_ENABLED) {
    return res.status(403).json({ error: 'Demo upgrades are disabled in production.' });
  }
  const plan = String(req.body?.plan || '');
  if (!PLAN_IDS.includes(plan)) return res.status(400).json({ error: 'Unknown plan' });
  const id = subscriberFrom(req);
  setSubscription(id, plan, 'demo', DEMO_TTL_MS);
  await persist();
  res.json(getSubscription(id));
});

app.post('/api/billing/checkout', async (req, res) => {
  try {
    await ensureInitialized();
    if (!PAYSTACK_SECRET_KEY) {
      return res.status(503).json({ error: 'Payments are not configured yet. Use demo mode to preview plans.', code: 'PAYMENTS_NOT_CONFIGURED' });
    }
    const plan = getPlan(req.body?.plan);
    const email = String(req.body?.email || '').trim();
    if (!email) return res.status(400).json({ error: 'Email is required for checkout' });
    if (plan.id === 'free') return res.status(400).json({ error: 'The free plan does not require checkout' });
    const subscriberId = subscriberFrom(req);
    const reference = `WP-${Date.now()}-${genId()}`;
    const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      body: JSON.stringify({
        email,
        amount: plan.price * 100,
        reference,
        callback_url: process.env.PAYSTACK_CALLBACK_URL || undefined,
        metadata: { subscriberId, plan: plan.id },
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.status) {
      return res.status(502).json({ error: data.message || 'Could not start checkout' });
    }
    res.json({ authorizationUrl: data.data.authorization_url, reference });
  } catch {
    res.status(500).json({ error: 'Could not start checkout' });
  }
});

app.get('/api/billing/verify', async (req, res) => {
  try {
    await ensureInitialized();
    if (!PAYSTACK_SECRET_KEY) return res.status(503).json({ error: 'Payments are not configured' });
    const reference = String(req.query.reference || '');
    if (!reference) return res.status(400).json({ error: 'reference required' });
    const response = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const data = await response.json();
    if (!response.ok || !data.status) return res.status(502).json({ error: 'Verification failed' });
    const transaction = data.data || {};
    if (transaction.status === 'success') {
      const id = String(transaction.metadata?.subscriberId || '');
      const plan = transaction.metadata?.plan;
      if (!id || id !== req.subscriberId) {
        return res.status(403).json({ error: 'Payment does not belong to this session.' });
      }
      if (!PLAN_IDS.includes(plan) || plan === 'free') {
        return res.status(400).json({ error: 'Invalid plan in payment metadata.' });
      }
      const expected = getPlan(plan);
      const amount = Number(transaction.amount);
      const currency = String(transaction.currency || '').toUpperCase();
      if (amount !== expected.price * 100 || currency !== expected.currency) {
        return res.status(409).json({ error: 'Payment amount or currency does not match the plan.' });
      }
      setSubscription(id, plan, 'paystack', 365 * 24 * 60 * 60 * 1000);
      await persist();
    }
    res.json({ success: transaction.status === 'success', subscription: getSubscription(req.subscriberId) });
  } catch {
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/billing/webhook', async (req, res) => {
  if (!PAYSTACK_SECRET_KEY) return res.status(503).json({ error: 'Payments are not configured' });
  const signature = req.get('x-paystack-signature') || '';
  const expected = createHmac('sha512', PAYSTACK_SECRET_KEY).update(req.rawBody || '').digest('hex');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  try {
    await ensureInitialized();
    const event = req.body || {};
    const eventId = String(event.id || signature);
    if (processedEvents.has(eventId)) return res.json({ received: true });
    processedEvents.add(eventId);
    if (event.event === 'charge.success') {
      const id = String(event.data?.metadata?.subscriberId || '');
      const plan = event.data?.metadata?.plan;
      if (id && PLAN_IDS.includes(plan) && plan !== 'free') {
        const expectedPlan = getPlan(plan);
        const amount = Number(event.data?.amount);
        const currency = String(event.data?.currency || '').toUpperCase();
        if (amount === expectedPlan.price * 100 && currency === expectedPlan.currency) {
          setSubscription(id, plan, 'paystack', 365 * 24 * 60 * 60 * 1000);
        }
      }
    }
    await persist();
    res.json({ received: true });
  } catch {
    res.status(500).json({ error: 'Webhook failed' });
  }
});

app.get('/api/maps', requireFeature('weatherMaps'), async (_req, res) => {
  try {
    const data = await fetchJson(RAINVIEWER_MAPS, { ttl: 10 * 60 * 1000 });
    res.json({
      host: data.host || 'https://tilecache.rainviewer.com',
      generatedAt: data.generated || Date.now(),
      radar: { past: data.radar?.past || [], nowcast: data.radar?.nowcast || [] },
      satellite: { infrared: data.satellite?.infrared || [] },
    });
  } catch {
    res.status(502).json({ error: 'Could not load map metadata' });
  }
});

const TILE_LAYERS = {
  temperature: 'temp_new',
  wind: 'wind_new',
  precipitation: 'precipitation_new',
  clouds: 'clouds_new',
  air: 'pollution_new',
};

app.get('/api/tiles/:layer/:z/:x/:y', requireFeature('weatherMaps'), async (req, res) => {
  const layer = TILE_LAYERS[req.params.layer];
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = Number(req.params.y);
  const limit = 2 ** z;
  if (!layer) return res.status(400).json({ error: 'Unknown map layer' });
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 18 || x < 0 || y < 0 || x >= limit || y >= limit) {
    return res.status(400).json({ error: 'Invalid tile coordinates' });
  }
  if (!API_KEY) return res.status(503).json({ error: 'Map tiles are not configured' });

  const key = `${layer}/${z}/${x}/${y}`;
  const cached = tileCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return res.set('Content-Type', 'image/png').set('Cache-Control', 'public, max-age=600').send(cached.buffer);
  }

  try {
    const response = await fetch(`${OWM_MAP_BASE}/${layer}/${z}/${x}/${y}.png?appid=${API_KEY}`);
    if (!response.ok) return res.status(response.status === 404 ? 404 : 502).json({ error: 'Map tile unavailable' });
    const buffer = Buffer.from(await response.arrayBuffer());
    tileCache.set(key, { buffer, expires: Date.now() + 10 * 60 * 1000 });
    if (tileCache.size > 500) tileCache.delete(tileCache.keys().next().value);
    return res.set('Content-Type', 'image/png').set('Cache-Control', 'public, max-age=600').send(buffer);
  } catch {
    return res.status(502).json({ error: 'Map tile unavailable' });
  }
});

const ALERT_METRICS = ['temperature', 'rain_probability', 'wind_speed', 'air_quality'];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function alertChannels() {
  return {
    email: Boolean(RESEND_API_KEY && ALERT_EMAIL_TO),
    sms: Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER && ALERT_SMS_TO),
    push: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
    webhook: Boolean(NOTIFICATION_WEBHOOK_URL),
    pushPublicKey: VAPID_PUBLIC_KEY || null,
  };
}

async function deliverNotification(notification, rule) {
  const results = {};
  const channels = rule.channels || ['in-app'];
  const configured = alertChannels();

  if (channels.includes('email') && configured.email) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: ALERT_EMAIL_FROM,
          to: ALERT_EMAIL_TO.split(',').map(value => value.trim()).filter(Boolean),
          subject: `WeatherPro alert: ${notification.city}`,
          html: `<p>${escapeHtml(notification.message)}</p><p>Rule: ${escapeHtml(rule.metric)} ${rule.operator} ${escapeHtml(rule.threshold)}</p>`,
        }),
      });
      results.email = response.ok ? 'sent' : `failed (HTTP ${response.status})`;
    } catch (err) {
      results.email = `failed (${err.message})`;
    }
  }

  if (channels.includes('sms') && configured.sms) {
    try {
      const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
      const body = new URLSearchParams({
        To: ALERT_SMS_TO,
        From: TWILIO_FROM_NUMBER,
        Body: `${notification.message} — WeatherPro alert`,
      });
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      results.sms = response.ok ? 'sent' : `failed (HTTP ${response.status})`;
    } catch (err) {
      results.sms = `failed (${err.message})`;
    }
  }

  const ownerSubscriptions = pushSubscriptions.filter(subscription => subscription.owner === rule.owner);
  if (channels.includes('push') && configured.push && ownerSubscriptions.length) {
    setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const payload = JSON.stringify({
      title: `WeatherPro alert · ${notification.city}`,
      body: notification.message,
      url: '/',
    });
    const outcomes = await Promise.allSettled(ownerSubscriptions.map(subscription => sendNotification(subscription, payload)));
    const sent = outcomes.filter(outcome => outcome.status === 'fulfilled').length;
    results.push = `${sent}/${outcomes.length} sent`;
    const stale = outcomes
      .map((outcome, index) => (outcome.status === 'rejected' && [404, 410].includes(outcome.reason?.statusCode) ? ownerSubscriptions[index].endpoint : null))
      .filter(Boolean);
    if (stale.length) {
      for (const endpoint of stale) {
        const index = pushSubscriptions.findIndex(subscription => subscription.endpoint === endpoint && subscription.owner === rule.owner);
        if (index >= 0) pushSubscriptions.splice(index, 1);
      }
      persist().catch(() => {});
    }
  }

  if (configured.webhook) {
    try {
      const response = await fetch(NOTIFICATION_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...notification, delivery: results }),
      });
      results.webhook = response.ok ? 'sent' : `failed (HTTP ${response.status})`;
    } catch {
      results.webhook = 'failed';
    }
  }

  return results;
}

async function recordNotification(rule, evaluation) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${rule.id}:${day}:${rule.metric}`;
  if (notifications.some(n => n.key === key)) return;
  const notification = {
    id: genId(),
    owner: rule.owner,
    key,
    ruleId: rule.id,
    city: rule.city || 'Selected location',
    metric: rule.metric,
    message: `${rule.city || 'Your location'}: ${evaluation.reason}`,
    channels: rule.channels || ['in-app'],
    createdAt: Date.now(),
    delivery: {},
  };
  notifications.unshift(notification);
  if (notifications.length > 100) notifications.pop();
  notification.delivery = await deliverNotification(notification, rule);
  persist().catch(e => console.error('Failed to persist notification:', e.message));
}

async function evaluatedRules(owner) {
  const userRules = owned(alertRules, owner);
  const groups = new Map();
  for (const rule of userRules) {
    if (!rule.enabled) continue;
    const key = `${rule.lat},${rule.lon}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rule);
  }
  const results = new Map();
  for (const [key, rules] of groups) {
    const [lat, lon] = key.split(',').map(Number);
    let forecast;
    try {
      forecast = await getPremiumForecastData({ lat, lon, days: 2, units: rules[0].units || 'metric' });
    } catch {
      continue;
    }
    let air = null;
    if (rules.some(rule => rule.metric === 'air_quality')) {
      try {
        const airData = await fetchJson(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`, { ttl: DEFAULT_TTL.air });
        air = airData.list?.[0]?.main?.aqi ?? null;
      } catch {
        air = null;
      }
    }
    for (const rule of rules) {
      const evaluation = evaluateRule(rule, forecast, air);
      results.set(rule.id, { ...rule, ...evaluation });
      if (evaluation.triggered) await recordNotification(rule, evaluation);
    }
  }
  return userRules.map(rule => results.get(rule.id) || { ...rule, triggered: false, value: null, reason: 'Rule is paused' });
}

app.get('/api/alerts/rules', requireFeature('customAlerts'), async (req, res) => {
  await ensureInitialized();
  if (req.query.evaluate === 'true') {
    res.json(await evaluatedRules(req.subscriberId));
    return;
  }
  res.json(owned(alertRules, req.subscriberId));
});

app.post('/api/alerts/rules', requireFeature('customAlerts'), async (req, res) => {
  try {
    await ensureInitialized();
    const { city, lat, lon, metric, operator = 'above', threshold, leadMinutes = 0, channels = ['in-app'], units = 'metric' } = req.body || {};
    if (!ALERT_METRICS.includes(metric)) return res.status(400).json({ error: 'Invalid metric' });
    if (!['above', 'below'].includes(operator)) return res.status(400).json({ error: 'Invalid operator' });
    if (!Number.isFinite(Number(threshold))) return res.status(400).json({ error: 'A numeric threshold is required' });
    if (owned(alertRules, req.subscriberId).length >= 20) {
      return res.status(403).json({ error: 'Alert rule limit reached.', code: 'RULE_LIMIT_REACHED' });
    }
    const configured = alertChannels();
    const allowedChannels = Array.isArray(channels)
      ? channels.filter(channel => ALERT_CHANNELS.includes(channel) && (channel === 'in-app' || configured[channel]))
      : ['in-app'];
    const location = await resolveLocation({ city, lat, lon });
    if (city) location.name = String(city);
    const rule = {
      id: genId(),
      owner: req.subscriberId,
      city: location.name,
      lat: location.lat,
      lon: location.lon,
      metric,
      operator,
      threshold: Number(threshold),
      leadMinutes: Math.max(0, Math.min(180, Number(leadMinutes) || 0)),
      channels: allowedChannels.length ? allowedChannels : ['in-app'],
      units: normalizeUnits(units),
      enabled: true,
      createdAt: Date.now(),
    };
    alertRules.unshift(rule);
    await persist();
    res.json(rule);
  } catch (err) {
    res.status(err.status && err.status < 600 ? err.status : 500).json({ error: 'Could not create alert rule' });
  }
});

app.put('/api/alerts/rules/:id', requireFeature('customAlerts'), async (req, res) => {
  await ensureInitialized();
  const rule = findOwned(alertRules, req.params.id, req.subscriberId);
  if (!rule) return res.status(404).json({ error: 'Not found' });
  if (typeof req.body?.enabled === 'boolean') rule.enabled = req.body.enabled;
  await persist();
  res.json(rule);
});

app.delete('/api/alerts/rules/:id', requireFeature('customAlerts'), async (req, res) => {
  await ensureInitialized();
  const rule = findOwned(alertRules, req.params.id, req.subscriberId);
  if (!rule) return res.status(404).json({ error: 'Not found' });
  alertRules.splice(alertRules.indexOf(rule), 1);
  await persist();
  res.json({ success: true });
});

app.get('/api/alerts/notifications', requireFeature('customAlerts'), async (req, res) => {
  await ensureInitialized();
  res.json(owned(notifications, req.subscriberId).slice(0, 20));
});

app.get('/api/alerts/channels', async (_req, res) => {
  res.json(alertChannels());
});

app.post('/api/alerts/push-subscription', requireFeature('customAlerts'), async (req, res) => {
  try {
    await ensureInitialized();
    const subscription = req.body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid push subscription' });
    }
    let endpoint;
    try {
      endpoint = new URL(String(subscription.endpoint));
    } catch {
      return res.status(400).json({ error: 'Invalid push endpoint' });
    }
    const hostAllowed = PUSH_HOSTS.some(host => endpoint.hostname === host || endpoint.hostname.endsWith(`.${host}`));
    if (endpoint.protocol !== 'https:' || !hostAllowed) {
      return res.status(400).json({ error: 'Unsupported push endpoint' });
    }
    if (!alertChannels().push) return res.status(503).json({ error: 'Push notifications are not configured' });
    const record = {
      endpoint: endpoint.toString(),
      owner: req.subscriberId,
      keys: { p256dh: String(subscription.keys.p256dh), auth: String(subscription.keys.auth) },
      expirationTime: subscription.expirationTime || null,
    };
    const userSubscriptions = owned(pushSubscriptions, req.subscriberId);
    const index = pushSubscriptions.findIndex(item => item.endpoint === record.endpoint && item.owner === req.subscriberId);
    if (index >= 0) pushSubscriptions[index] = record;
    else {
      if (userSubscriptions.length >= 10) {
        pushSubscriptions.splice(pushSubscriptions.indexOf(userSubscriptions[0]), 1);
      }
      pushSubscriptions.push(record);
    }
    await persist();
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Could not save push subscription' });
  }
});

export default app;
