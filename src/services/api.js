const BASE = '/api';

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(e.error || `HTTP ${r.status}`);
  }
  return r.json();
}

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(e.error || `HTTP ${r.status}`);
  }
  return r.json();
}

async function del(path) {
  const r = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(e.error || `HTTP ${r.status}`);
  }
  return r.json();
}

export const api = {
  getCurrent: (params) => {
    const qs = new URLSearchParams(params).toString();
    return get(`/weather/current?${qs}`);
  },
  getForecast: (params) => {
    const qs = new URLSearchParams(params).toString();
    return get(`/weather/forecast?${qs}`);
  },
  getAirQuality: (lat, lon) => get(`/weather/air?lat=${lat}&lon=${lon}`),
  getAlerts: (lat, lon) => get(`/weather/alerts?lat=${lat}&lon=${lon}`),
  geocode: (q) => get(`/geocode?q=${encodeURIComponent(q)}&limit=5`),
  reverseGeocode: (lat, lon) => get(`/reverse-geocode?lat=${lat}&lon=${lon}&limit=1`),
  getFavorites: () => get('/favorites'),
  addFavorite: (data) => post('/favorites', data),
  removeFavorite: (id) => del(`/favorites/${id}`),
  getHistory: () => get('/history'),
  removeHistory: (id) => del(`/history/${id}`),
  clearHistory: () => del('/history'),
};
