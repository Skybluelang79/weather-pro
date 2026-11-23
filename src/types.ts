export interface GeoLocation {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

export interface WeatherData {
  coord: { lon: number; lat: number };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  base: string;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
    sea_level?: number;
    grnd_level?: number;
  };
  visibility: number;
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  clouds: { all: number };
  dt: number;
  sys: {
    country: string;
    sunrise: number;
    sunset: number;
  };
  timezone: number;
  id: number;
  name: string;
  cod: number;
}

export interface ForecastData {
  cod: string;
  message: number;
  cnt: number;
  list: Array<{
    dt: number;
    main: {
      temp: number;
      feels_like: number;
      temp_min: number;
      temp_max: number;
      pressure: number;
      humidity: number;
    };
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
    clouds: { all: number };
    wind: { speed: number; deg: number };
    visibility: number;
    pop: number;
    sys: { pod: string };
    dt_txt: string;
  }>;
  city: {
    name: string;
    country: string;
    timezone: number;
    sunrise: number;
    sunset: number;
  };
}

export interface AirQualityData {
  list: Array<{
    main: { aqi: number };
    components: {
      co: number;
      no: number;
      no2: number;
      o3: number;
      so2: number;
      pm2_5: number;
      pm10: number;
      nh3: number;
    };
    dt: number;
  }>;
}

export interface AlertData {
  id: string;
  event: string;
  headline: string;
  severity: string;
  urgency: string;
  description: string;
  instruction: string;
}

export interface Favorite {
  id: string;
  city: string;
  country: string;
  lat?: number;
  lon?: number;
  addedAt: number;
}

export interface HistoryEntry {
  id: string;
  city: string;
  country?: string;
  timestamp: number;
}

export type WeatherType = 'clear' | 'clouds' | 'rain' | 'storm' | 'snow' | 'fog';

export interface PremiumDay {
  date: string;
  dayLabel: string;
  code: number;
  description: string;
  icon: string;
  tempMax: number;
  tempMin: number;
  feelsMax: number;
  feelsMin: number;
  precipSum: number;
  precipProbability: number;
  windSpeed: number;
  windGust: number;
  windDeg: number;
  sunrise: string;
  sunset: string;
  uvIndex: number;
  confidence: 'high' | 'low';
  source: 'forecast' | 'climate' | 'projection';
  modeled: boolean;
}

export interface PremiumHour {
  time: string;
  temp: number;
  feelsLike: number;
  precipProbability: number;
  precip: number;
  humidity: number;
  code: number;
  description: string;
  icon: string;
  windSpeed: number;
  windGust: number;
  windDeg: number;
}

export interface PremiumForecastData {
  location: { name: string; country: string; lat: number; lon: number; timezone: string };
  daily: PremiumDay[];
  hourly: PremiumHour[];
  units: 'metric' | 'imperial';
  generatedAt: number;
  disclaimer: string;
}

export interface AIAnswer {
  answer: string;
  provider: 'ai' | 'rules';
  disclaimer: string;
  fallbackReason?: string;
  location?: { name: string; country: string };
}

export type AlertMetric = 'temperature' | 'rain_probability' | 'wind_speed' | 'air_quality';

export interface AlertRule {
  id: string;
  city: string;
  lat: number;
  lon: number;
  metric: AlertMetric;
  operator: 'above' | 'below';
  threshold: number;
  leadMinutes: number;
  channels: string[];
  units: 'metric' | 'imperial';
  enabled: boolean;
  createdAt: number;
  triggered?: boolean;
  value?: number | null;
  reason?: string;
}

export interface AlertNotification {
  id: string;
  key: string;
  ruleId: string;
  city: string;
  metric: string;
  message: string;
  channels: string[];
  createdAt: number;
  delivery?: AlertDelivery;
}

export type PlanId = 'free' | 'pro' | 'premium';

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  currency: string;
  tagline: string;
  features: string[];
  featured?: boolean;
}

export interface Subscription {
  plan: PlanId;
  status: string;
  source: 'free' | 'demo' | 'paystack';
  since: number | null;
}

export interface RadarFrame {
  time: number;
  path: string;
}

export interface WeatherMapsData {
  host: string;
  generatedAt: number;
  radar: { past: RadarFrame[]; nowcast: RadarFrame[] };
  satellite: { infrared: RadarFrame[] };
}

export interface AlertChannels {
  email: boolean;
  sms: boolean;
  push: boolean;
  webhook: boolean;
  pushPublicKey: string | null;
}

export interface AlertDelivery {
  email?: string;
  sms?: string;
  push?: string;
  webhook?: string;
}