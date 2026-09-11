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