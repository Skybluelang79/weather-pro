import type {
  WeatherData, ForecastData, AirQualityData, AlertData, GeoLocation, Favorite, HistoryEntry,
  PremiumForecastData, AIAnswer, Plan, Subscription, AlertRule, AlertNotification, PlanId,
} from '../types';

const BASE = '/api';
const SUBSCRIBER_KEY = 'weatherpro-subscriber-id';

export function getSubscriberId(): string {
  let id = localStorage.getItem(SUBSCRIBER_KEY);
  if (!id) {
    id = `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SUBSCRIBER_KEY, id);
  }
  return id;
}

async function request(path: string, options?: RequestInit): Promise<any> {
  const r = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-subscriber-id': getSubscriberId(),
      ...options?.headers,
    },
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: 'Request failed' }));
    const error = new Error(e.error || `HTTP ${r.status}`);
    (error as Error & { code?: string }).code = e.code;
    throw error;
  }
  return r.json();
}

const get = (path: string): Promise<any> => request(path);
const post = (path: string, body: unknown): Promise<any> => request(path, { method: 'POST', body: JSON.stringify(body) });
const del = (path: string): Promise<any> => request(path, { method: 'DELETE' });
const put = (path: string, body: unknown): Promise<any> => request(path, { method: 'PUT', body: JSON.stringify(body) });

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

  getPremiumForecast: (params: { city?: string; lat?: number; lon?: number; days: number; units: string }): Promise<PremiumForecastData> => {
    const qs = new URLSearchParams({
      days: String(params.days),
      units: params.units,
      ...(params.lat !== undefined && params.lon !== undefined
        ? { lat: String(params.lat), lon: String(params.lon) }
        : { city: params.city || '' }),
    }).toString();
    return get(`/premium/forecast?${qs}`);
  },
  askAI: (data: { question: string; city?: string; lat?: number; lon?: number; units: string }): Promise<AIAnswer> =>
    post('/ai/weather', data),

  getPlans: (): Promise<{ plans: Plan[]; currency: string; paymentsConfigured: boolean }> => get('/plans'),
  getSubscription: (): Promise<Subscription> => get('/subscription'),
  setDemoPlan: (plan: PlanId): Promise<Subscription> => post('/subscription/demo', { plan, subscriberId: getSubscriberId() }),
  startCheckout: (plan: PlanId, email: string): Promise<{ authorizationUrl: string; reference: string }> =>
    post('/billing/checkout', { plan, email, subscriberId: getSubscriberId() }),
  verifyBilling: (reference: string): Promise<{ success: boolean; subscription: Subscription }> =>
    get(`/billing/verify?reference=${encodeURIComponent(reference)}&subscriberId=${encodeURIComponent(getSubscriberId())}`),

  getAlertRules: (evaluate = false): Promise<AlertRule[]> => get(`/alerts/rules${evaluate ? '?evaluate=true' : ''}`),
  createAlertRule: (rule: Omit<AlertRule, 'id' | 'createdAt' | 'enabled'>): Promise<AlertRule> => post('/alerts/rules', rule),
  updateAlertRule: (id: string, enabled: boolean): Promise<AlertRule> => put(`/alerts/rules/${id}`, { enabled }),
  removeAlertRule: (id: string): Promise<{ success: boolean }> => del(`/alerts/rules/${id}`),
  getNotifications: (): Promise<AlertNotification[]> => get('/alerts/notifications'),
};
