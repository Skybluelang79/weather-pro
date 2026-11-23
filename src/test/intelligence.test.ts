import { describe, expect, it } from 'vitest';
import { evaluateRule, generateRuleAnswer, weatherCodeInfo } from '../../netlify/functions/_shared/intelligence.js';

const daily = [
  {
    date: '2026-11-23', dayLabel: 'Today', code: 61, description: 'Rain', icon: '10d',
    tempMax: 31, tempMin: 24, feelsMax: 34, feelsMin: 25, precipSum: 12,
    precipProbability: 65, windSpeed: 18, windGust: 32, windDeg: 210,
    sunrise: '', sunset: '', uvIndex: 6, confidence: 'high', source: 'forecast', modeled: false,
  },
  {
    date: '2026-11-24', dayLabel: 'Tue', code: 0, description: 'Clear sky', icon: '01d',
    tempMax: 34, tempMin: 25, feelsMax: 36, feelsMin: 26, precipSum: 0,
    precipProbability: 10, windSpeed: 12, windGust: 20, windDeg: 180,
    sunrise: '', sunset: '', uvIndex: 7, confidence: 'high', source: 'forecast', modeled: false,
  },
];

const hourly = [
  { time: '2026-11-23T06:00', temp: 25, feelsLike: 26, precipProbability: 20, precip: 0, humidity: 70, code: 2, description: 'Partly cloudy', icon: '02d', windSpeed: 10, windGust: 14, windDeg: 200 },
  { time: '2026-11-23T07:00', temp: 26, feelsLike: 27, precipProbability: 80, precip: 3, humidity: 84, code: 63, description: 'Rain', icon: '10d', windSpeed: 12, windGust: 18, windDeg: 205 },
  { time: '2026-11-23T14:00', temp: 31, feelsLike: 34, precipProbability: 80, precip: 4, humidity: 85, code: 63, description: 'Rain', icon: '10d', windSpeed: 18, windGust: 33, windDeg: 210 },
];

describe('weather intelligence fallback', () => {
  it('maps WMO codes to icons', () => {
    expect(weatherCodeInfo(95).description).toBe('Thunderstorm');
    expect(weatherCodeInfo(61).icon).toBe('10d');
  });

  it('answers rain questions using forecast values', () => {
    const result = generateRuleAnswer({ question: 'Will it rain today?', location: { name: 'Lagos' }, daily, hourly });
    expect(result.answer).toContain('Lagos');
    expect(result.answer).toContain('80%');
    expect(result.provider).toBe('rules');
  });

  it('recommends a travel window', () => {
    const result = generateRuleAnswer({ question: 'Best time to travel?', location: { name: 'Lagos' }, daily, hourly });
    expect(result.answer).toContain('06:00');
  });

  it('compares tomorrow with today', () => {
    const result = generateRuleAnswer({ question: 'How is tomorrow different?', location: { name: 'Lagos' }, daily, hourly });
    expect(result.answer).toContain('warmer by 3°C');
  });
});

describe('custom alert evaluation', () => {
  const forecast = { hourly, units: 'metric' };

  it('triggers when a threshold is exceeded', () => {
    const result = evaluateRule({ metric: 'rain_probability', operator: 'above', threshold: 70, leadMinutes: 120 }, forecast);
    expect(result.triggered).toBe(true);
    expect(result.value).toBe(80);
  });

  it('does not trigger below the threshold', () => {
    const result = evaluateRule({ metric: 'temperature', operator: 'above', threshold: 40 }, forecast);
    expect(result.triggered).toBe(false);
  });

  it('uses air quality data when supplied', () => {
    const result = evaluateRule({ metric: 'air_quality', operator: 'above', threshold: 100 }, forecast, 140);
    expect(result.triggered).toBe(true);
    expect(result.value).toBe(140);
  });
});
