import type { WeatherType } from '../types';

const icons = {
  '01d': '☀️', '01n': '🌙',
  '02d': '⛅', '02n': '☁️',
  '03d': '☁️', '03n': '☁️',
  '04d': '☁️', '04n': '☁️',
  '09d': '🌧️', '09n': '🌧️',
  '10d': '🌦️', '10n': '🌧️',
  '11d': '⛈️', '11n': '⛈️',
  '13d': '❄️', '13n': '❄️',
  '50d': '🌫️', '50n': '🌫️',
};

export function getWeatherIcon(code: string | null): string {
  return icons[code as keyof typeof icons] || '🌤️';
}

export function getWeatherType(code: string | null): WeatherType {
  if (!code) return 'clear';
  const id = code.slice(0, 2);
  if (id === '01') return 'clear';
  if (id === '02') return 'clouds';
  if (id === '03' || id === '04') return 'clouds';
  if (id === '09' || id === '10') return 'rain';
  if (id === '11') return 'storm';
  if (id === '13') return 'snow';
  if (id === '50') return 'fog';
  return 'clear';
}

export function getWeatherGradient(type: WeatherType, isDay = true): string {
  const gradients: Record<WeatherType, string> = {
    clear: isDay
      ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 30%, #fda085 70%, #f6d365 100%)'
      : 'linear-gradient(135deg, #0c0d2e 0%, #1a1a4e 30%, #2d1b69 60%, #11001c 100%)',
    clouds: isDay
      ? 'linear-gradient(135deg, #89ABE3 0%, #B0C4DE 40%, #E0E5EC 100%)'
      : 'linear-gradient(135deg, #2c3e50 0%, #4a5568 40%, #718096 100%)',
    rain: 'linear-gradient(135deg, #373B44 0%, #4286f4 50%, #373B44 100%)',
    storm: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    snow: 'linear-gradient(135deg, #E6DADA 0%, #BDC3C7 50%, #a8c0ff 100%)',
    fog: 'linear-gradient(135deg, #606c88 0%, #3f4c6b 100%)',
  };
  return gradients[type] || gradients.clear;
}

export function formatTemp(temp: number, unit = 'C'): string {
  if (unit === 'F') return `${Math.round(temp * 9/5 + 32)}°F`;
  return `${Math.round(temp)}°C`;
}

export function formatTime(ts: number, tz: number): string {
  const d = new Date((ts + tz) * 1000);
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function getWindDirection(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function generateFaviconSVG(iconCode: string): string {
  const id = iconCode ? iconCode.slice(0, 2) : '01';
  const isDay = iconCode ? iconCode.endsWith('d') : true;

  let emoji;
  if (id === '01') emoji = isDay ? '☀️' : '🌙';
  else if (['02', '03', '04'].includes(id)) emoji = '⛅';
  else if (['09', '10'].includes(id)) emoji = '🌧️';
  else if (id === '11') emoji = '⛈️';
  else if (id === '13') emoji = '❄️';
  else if (id === '50') emoji = '🌫️';
  else emoji = '🌤️';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text x="32" y="44" font-size="40" text-anchor="middle">${emoji}</text></svg>`;
}

export function getAQILevel(aqi: number): { label: string; color: string; desc: string } {
  const levels = [
    { label: 'Good', color: '#4ADE80', desc: 'Air quality is satisfactory' },
    { label: 'Fair', color: '#A3E635', desc: 'Acceptable air quality' },
    { label: 'Moderate', color: '#FBBF24', desc: 'Moderate health concern' },
    { label: 'Poor', color: '#F97316', desc: 'Health effects possible' },
    { label: 'Very Poor', color: '#EF4444', desc: 'Health alert: serious effects' },
  ];
  return levels[Math.min(aqi - 1, 4)] || levels[0];
}