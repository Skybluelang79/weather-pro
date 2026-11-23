import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import fetch from 'node-fetch';
import { createHmac } from 'crypto';
import { loadData, saveData } from './storage.js';
import { generateAIAnswer, evaluateRule, weatherCodeInfo, DISCLAIMER } from './intelligence.js';
import { PLANS, PLAN_IDS, getPlan } from './plans.js';

config();

const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS) || 0;
const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE = 'https://api.openweathermap.org/data/2.5';
const GEO_BASE = 'https://api.openweathermap.org/geo/1.0';
const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const OPEN_METEO_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const PAYSTACK_BASE = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

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
app.use(cors());
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf.toString(); } }));

app.use((req, res, next) => {
  if (req.path.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '/api');
  }
  next();
});

const buckets = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60 * 1000;

function rateLimiter(req, res, next) {
  if (!req.path.startsWith('/api')) return next();
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
    bucket = { windowStart: now, tokens: RATE_LIMIT - 1 };
    buckets.set(ip, bucket);
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
let initPromise = null;

function ensureInitialized() {
  if (!initPromise) {
    initPromise = loadData().then((data) => {
      favorites.push(...(data.favorites || []));
      searchHistory.push(...(data.searchHistory || []));
      alertRules.push(...(data.alertRules || []));
      notifications.push(...(data.notifications || []));
      Object.assign(subscriptions, data.subscriptions || {});
    }).catch((e) => console.error('Failed to load persisted state:', e.message));
  }
  return initPromise;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function persist() {
  await saveData({ favorites, searchHistory, alertRules, notifications, subscriptions });
}

function subscriberFrom(req) {
  return String(req.query?.subscriberId || req.get?.('x-subscriber-id') || req.body?.subscriberId || 'anonymous');
}

function normalizeUnits(units) {
  return units === 'imperial' ? 'imperial' : 'metric';
}

function validCoord(lat, lon) {
  const a = Number(lat);
  const b = Number(lon);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180;
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
    const { city, lat, lon, units = 'metric' } = req.query;
    let url;
    if (lat && lon) {
      url = `${BASE}/weather?lat=${lat}&lon=${lon}&units=${normalizeUnits(units)}&appid=${API_KEY}`;
    } else if (city) {
      url = `${BASE}/weather?q=${encodeURIComponent(city)}&units=${normalizeUnits(units)}&appid=${API_KEY}`;
    } else {
      return res.status(400).json({ error: 'Provide city or lat/lon' });
    }
    const data = await fetchJson(url, { ttl: DEFAULT_TTL.weather });
    if (data.cod && data.cod !== 200) {
      return res.status(data.cod).json({ error: data.message });
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(err.status && err.status < 600 ? err.status : 500).json({ error: err.message || 'Failed to fetch weather' });
  }
});

app.get('/api/weather/forecast', async (req, res) => {
  try {
    const { city, lat, lon, units = 'metric' } = req.query;
    let url;
    if (lat && lon) {
      url = `${BASE}/forecast?lat=${lat}&lon=${lon}&units=${normalizeUnits(units)}&appid=${API_KEY}`;
    } else if (city) {
      url = `${BASE}/forecast?q=${encodeURIComponent(city)}&units=${normalizeUnits(units)}&appid=${API_KEY}`;
    } else {
      return res.status(400).json({ error: 'Provide city or lat/lon' });
    }
    const data = await fetchJson(url, { ttl: DEFAULT_TTL.forecast });
    if (data.cod && data.cod !== '200') {
      return res.status(400).json({ error: data.message });
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(err.status && err.status < 600 ? err.status : 500).json({ error: err.message || 'Failed to fetch forecast' });
  }
});

app.get('/api/weather/air', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
    const data = await fetchJson(url, { ttl: DEFAULT_TTL.air });
    res.json(data);
  } catch (err) {
    res.status(err.status && err.status < 600 ? err.status : 500).json({ error: err.message || 'Failed to fetch air quality' });
  }
});

app.get('/api/weather/alerts', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
    try {
      const pointUrl = `https://api.weather.gov/points/${lat},${lon}`;
      const pointR = await fetch(pointUrl, {
        headers: { 'User-Agent': 'WeatherPro/1.0', 'Accept': 'application/json' },
      });
      if (pointR.ok) {
        const alertsUrl = `https://api.weather.gov/alerts/point?lat=${lat}&lon=${lon}`;
        const r = await fetch(alertsUrl, {
          headers: { 'User-Agent': 'WeatherPro/1.0', 'Accept': 'application/json' },
        });
        if (!r.ok) return res.json({ alerts: [] });
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
      }
    } catch {
      res.json({ alerts: [] });
      return;
    }
    res.json({ alerts: [] });
  } catch {
    res.json({ alerts: [] });
  }
});

app.get('/api/geocode', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;
    if (!q) return res.status(400).json({ error: 'q required' });
    const url = `${GEO_BASE}/direct?q=${encodeURIComponent(q)}&limit=${limit}&appid=${API_KEY}`;
    const data = await fetchJson(url, { ttl: DEFAULT_TTL.geocode });
    res.json(data);
  } catch (err) {
    res.status(err.status && err.status < 600 ? err.status : 500).json({ error: err.message || 'Failed to geocode' });
  }
});

app.get('/api/reverse-geocode', async (req, res) => {
  try {
    const { lat, lon, limit = 1 } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
    const url = `${GEO_BASE}/reverse?lat=${lat}&lon=${lon}&limit=${limit}&appid=${API_KEY}`;
    const data = await fetchJson(url, { ttl: DEFAULT_TTL.geocode });
    res.json(data);
  } catch (err) {
    res.status(err.status && err.status < 600 ? err.status : 500).json({ error: err.message || 'Failed to reverse geocode' });
  }
});

app.get('/api/favorites', async (req, res) => {
  await ensureInitialized();
  res.json(favorites);
});

app.post('/api/favorites', async (req, res) => {
  await ensureInitialized();
  const { city, country, lat, lon } = req.body;
  if (!city) return res.status(400).json({ error: 'city required' });
  if (favorites.find(f => f.city.toLowerCase() === city.toLowerCase())) {
    return res.status(409).json({ error: 'Already in favorites' });
  }
  const fav = { id: genId(), city, country, lat, lon, addedAt: Date.now() };
  favorites.unshift(fav);
  await persist();
  res.json(fav);
});

app.delete('/api/favorites/:id', async (req, res) => {
  await ensureInitialized();
  const idx = favorites.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  favorites.splice(idx, 1);
  await persist();
  res.json({ success: true });
});

app.get('/api/history', async (req, res) => {
  await ensureInitialized();
  res.json(searchHistory);
});

app.post('/api/history/record', async (req, res) => {
  try {
    await ensureInitialized();
    const { city, country } = req.body;
    if (!city) return res.status(400).json({ error: 'city required' });
    const existing = searchHistory.find(h => h.city.toLowerCase() === city.toLowerCase());
    if (existing) {
      existing.timestamp = Date.now();
      searchHistory.splice(searchHistory.indexOf(existing), 1);
      searchHistory.unshift(existing);
    } else {
      searchHistory.unshift({ id: genId(), city, country, timestamp: Date.now() });
      if (searchHistory.length > 20) searchHistory.pop();
    }
    await persist();
    res.json({ success: true, searchHistory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to record history' });
  }
});

app.delete('/api/history/:id', async (req, res) => {
  await ensureInitialized();
  const idx = searchHistory.findIndex(h => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  searchHistory.splice(idx, 1);
  await persist();
  res.json({ success: true });
});

app.delete('/api/history', async (req, res) => {
  await ensureInitialized();
  searchHistory.length = 0;
  await persist();
  res.json({ success: true });
});

app.get('/api/premium/forecast', async (req, res) => {
  try {
    const { city, lat, lon, days = 7, units = 'metric' } = req.query;
    const location = await resolveLocation({ city, lat, lon });
    if (city) location.name = String(city);
    const forecast = await getPremiumForecastData({ lat: location.lat, lon: location.lon, days, units });
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
    res.status(err.status && err.status < 600 ? err.status : 500).json({ error: err.message || 'Failed to load extended forecast' });
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

app.post('/api/ai/weather', aiLimiter, async (req, res) => {
  try {
    const { question = '', city, lat, lon, units = 'metric', days = 7 } = req.body || {};
    if (question.length > 600) return res.status(400).json({ error: 'Question is too long' });
    const location = await resolveLocation({ city, lat, lon });
    if (city) location.name = String(city);
    const forecast = await getPremiumForecastData({ lat: location.lat, lon: location.lon, days, units });
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
    res.status(err.status && err.status < 600 ? err.status : 500).json({ error: err.message || 'AI assistant unavailable' });
  }
});

function getSubscription(subscriberId) {
  return subscriptions[subscriberId] || { plan: 'free', status: 'active', source: 'free', since: null };
}

function setSubscription(subscriberId, plan, source) {
  subscriptions[subscriberId] = { plan, status: 'active', source, since: Date.now() };
}

app.get('/api/plans', (_req, res) => {
  res.json({ plans: Object.values(PLANS), currency: 'NGN', paymentsConfigured: Boolean(PAYSTACK_SECRET_KEY) });
});

app.get('/api/subscription', async (req, res) => {
  await ensureInitialized();
  res.json(getSubscription(subscriberFrom(req)));
});

app.post('/api/subscription/demo', async (req, res) => {
  await ensureInitialized();
  const plan = String(req.body?.plan || '');
  if (!PLAN_IDS.includes(plan)) return res.status(400).json({ error: 'Unknown plan' });
  const subscription = { ...getSubscription(subscriberFrom(req)), plan, source: 'demo', since: Date.now() };
  subscriptions[subscriberFrom(req)] = subscription;
  await persist();
  res.json(subscription);
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
  } catch (err) {
    res.status(500).json({ error: err.message || 'Could not start checkout' });
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
    if (!response.ok || !data.status) return res.status(502).json({ error: data.message || 'Verification failed' });
    const transaction = data.data || {};
    const id = subscriberFrom(req);
    if (transaction.status === 'success') {
      const plan = PLAN_IDS.includes(transaction.metadata?.plan) ? transaction.metadata.plan : 'pro';
      setSubscription(id, plan, 'paystack');
      await persist();
    }
    res.json({ success: transaction.status === 'success', subscription: getSubscription(id) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

app.post('/api/billing/webhook', async (req, res) => {
  if (!PAYSTACK_SECRET_KEY) return res.status(503).json({ error: 'Payments are not configured' });
  const signature = req.get('x-paystack-signature') || '';
  const expected = createHmac('sha512', PAYSTACK_SECRET_KEY).update(req.rawBody || '').digest('hex');
  if (signature !== expected) return res.status(401).json({ error: 'Invalid signature' });
  try {
    await ensureInitialized();
    const event = req.body || {};
    if (event.event === 'charge.success') {
      const id = event.data?.metadata?.subscriberId;
      const plan = event.data?.metadata?.plan;
      if (id && PLAN_IDS.includes(plan)) {
        setSubscription(String(id), plan, 'paystack');
        await persist();
      }
    }
    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Webhook failed' });
  }
});

const ALERT_METRICS = ['temperature', 'rain_probability', 'wind_speed', 'air_quality'];

function recordNotification(rule, evaluation) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${rule.id}:${day}:${rule.metric}`;
  if (notifications.some(n => n.key === key)) return;
  const notification = {
    id: genId(),
    key,
    ruleId: rule.id,
    city: rule.city || 'Selected location',
    metric: rule.metric,
    message: `${rule.city || 'Your location'}: ${evaluation.reason}`,
    channels: rule.channels || ['in-app'],
    createdAt: Date.now(),
  };
  notifications.unshift(notification);
  if (notifications.length > 100) notifications.pop();
  persist().catch(e => console.error('Failed to persist notification:', e.message));
  if (process.env.NOTIFICATION_WEBHOOK_URL) {
    fetch(process.env.NOTIFICATION_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification),
    }).catch(() => {});
  }
}

async function evaluatedRules() {
  const groups = new Map();
  for (const rule of alertRules) {
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
      if (evaluation.triggered) recordNotification(rule, evaluation);
    }
  }
  return alertRules.map(rule => results.get(rule.id) || { ...rule, triggered: false, value: null, reason: 'Rule is paused' });
}

app.get('/api/alerts/rules', async (req, res) => {
  await ensureInitialized();
  if (req.query.evaluate === 'true') {
    res.json(await evaluatedRules());
    return;
  }
  res.json(alertRules);
});

app.post('/api/alerts/rules', async (req, res) => {
  try {
    await ensureInitialized();
    const { city, lat, lon, metric, operator = 'above', threshold, leadMinutes = 0, channels = ['in-app'], units = 'metric' } = req.body || {};
    if (!ALERT_METRICS.includes(metric)) return res.status(400).json({ error: 'Invalid metric' });
    if (!['above', 'below'].includes(operator)) return res.status(400).json({ error: 'Invalid operator' });
    if (!Number.isFinite(Number(threshold))) return res.status(400).json({ error: 'A numeric threshold is required' });
    const location = await resolveLocation({ city, lat, lon });
    if (city) location.name = String(city);
    const rule = {
      id: genId(),
      city: location.name,
      lat: location.lat,
      lon: location.lon,
      metric,
      operator,
      threshold: Number(threshold),
      leadMinutes: Math.max(0, Math.min(180, Number(leadMinutes) || 0)),
      channels: Array.isArray(channels) ? channels : ['in-app'],
      units: normalizeUnits(units),
      enabled: true,
      createdAt: Date.now(),
    };
    alertRules.unshift(rule);
    await persist();
    res.json(rule);
  } catch (err) {
    res.status(err.status && err.status < 600 ? err.status : 500).json({ error: err.message || 'Could not create alert rule' });
  }
});

app.put('/api/alerts/rules/:id', async (req, res) => {
  await ensureInitialized();
  const rule = alertRules.find(r => r.id === req.params.id);
  if (!rule) return res.status(404).json({ error: 'Not found' });
  if (typeof req.body?.enabled === 'boolean') rule.enabled = req.body.enabled;
  await persist();
  res.json(rule);
});

app.delete('/api/alerts/rules/:id', async (req, res) => {
  await ensureInitialized();
  const idx = alertRules.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  alertRules.splice(idx, 1);
  await persist();
  res.json({ success: true });
});

app.get('/api/alerts/notifications', async (_req, res) => {
  await ensureInitialized();
  res.json(notifications.slice(0, 20));
});

export default app;
