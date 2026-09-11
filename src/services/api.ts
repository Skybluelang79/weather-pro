import type { WeatherData, ForecastData, AirQualityData, AlertData, GeoLocation, Favorite, HistoryEntry } from '../types';

const BASE = '/api';

async function get(path: string): Promise<any> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(e.error || `HTTP ${r.status}`);
  }
  return r.json();
}

async function post(path: string, body: unknown): Promise<any> {
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

async function del(path: string): Promise<any> {
  const r = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(e.error || `HTTP ${r.status}`);
  }
  return r.json();
}

export const api = {
  getCurrent: (params: Record<string, string>): Promise<WeatherData> => {
    const qs = new URLSearchParams(params).toString();
    return get(`/weather/current?${qs}`);
  },
  getForecast: (params: Record<string, string>): Promise<ForecastData> => {
    const qs = new URLSearchParams(params).toString();
    return get(`/weather/forecast?${qs}`);
  },
  getAirQuality: (lat: number, lon: number): Promise<AirQualityData> => get(`/weather/air?lat=${lat}&lon=${lon}`),
  getAlerts: (lat: number, lon: number): Promise<{ alerts: AlertData[] }> => get(`/weather/alerts?lat=${lat}&lon=${lon}`),
  geocode: (q: string): Promise<GeoLocation[]> => get(`/geocode?q=${encodeURIComponent(q)}&limit=5`),
  reverseGeocode: (lat: number, lon: number): Promise<GeoLocation[]> => get(`/reverse-geocode?lat=${lat}&lon=${lon}&limit=1`),
  getFavorites: (): Promise<Favorite[]> => get('/favorites'),
  addFavorite: (data: { city: string; country: string; lat?: number; lon?: number }): Promise<Favorite> => post('/favorites', data),
  removeFavorite: (id: string): Promise<{ success: boolean }> => del(`/favorites/${id}`),
  getHistory: (): Promise<HistoryEntry[]> => get('/history'),
  recordHistory: (data: { city: string; country?: string }): Promise<{ success: boolean; searchHistory: HistoryEntry[] }> => post('/history/record', data),
  removeHistory: (id: string): Promise<{ success: boolean }> => del(`/history/${id}`),
  clearHistory: (): Promise<{ success: boolean }> => del('/history'),
};