import { useState, useMemo } from 'react';
import type { WeatherData } from '../types';
import { formatTemp } from '../services/helpers';

interface MetricsEntry {
  name: string | undefined;
  country: string | undefined;
  temp: number | undefined;
  feels_like: number | undefined;
  humidity: number | undefined;
  wind_speed: number | undefined;
  pressure: number | undefined;
  visibility: string | null;
}

interface MetricDef {
  key: keyof MetricsEntry;
  label: string;
  unit: (unit: string) => string;
}

const metrics: MetricDef[] = [
  { key: 'temp' as const, label: 'Temperature', unit: (u: string) => u === 'F' ? '°F' : '°C' },
  { key: 'feels_like' as const, label: 'Feels Like', unit: (u: string) => u === 'F' ? '°F' : '°C' },
  { key: 'humidity' as const, label: 'Humidity', unit: () => '%' },
  { key: 'wind_speed' as const, label: 'Wind Speed', unit: () => 'm/s' },
  { key: 'pressure' as const, label: 'Pressure', unit: () => 'hPa' },
  { key: 'visibility' as const, label: 'Visibility', unit: () => 'km' },
];

function extractMetrics(weather: WeatherData | null): MetricsEntry | null {
  if (!weather) return null;
  return {
    name: weather.name,
    country: weather.sys?.country,
    temp: weather.main?.temp,
    feels_like: weather.main?.feels_like,
    humidity: weather.main?.humidity,
    wind_speed: weather.wind?.speed,
    pressure: weather.main?.pressure,
    visibility: weather.visibility != null ? (weather.visibility / 1000).toFixed(1) : null,
  };
}

interface WeatherCompareProps {
  weatherA: WeatherData;
  weatherB: WeatherData;
  unit: string;
}

export default function WeatherCompare({ weatherA, weatherB, unit }: WeatherCompareProps) {
  const [swap, setSwap] = useState(false);

  const a = useMemo(() => extractMetrics(weatherA), [weatherA]);
  const b = useMemo(() => extractMetrics(weatherB), [weatherB]);

  const left = swap ? b : a;
  const right = swap ? a : b;

  if (!left || !right) return null;

  return (
    <div className="weather-compare">
      <div className="compare-header">
        <h3 className="section-title">Compare Cities</h3>
        <button className="compare-swap" onClick={() => setSwap(s => !s)} title="Swap cities">
          ⇄ Swap
        </button>
      </div>
      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="compare-label-col">Metric</th>
              <th className="compare-city-col">{left.name}{left.country ? `, ${left.country}` : ''}</th>
              <th className="compare-city-col">{right.name}{right.country ? `, ${right.country}` : ''}</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(m => {
              const lv = left[m.key];
              const rv = right[m.key];
              const lNum = parseFloat(String(lv));
              const rNum = parseFloat(String(rv));
              let lClass = '';
              let rClass = '';
              if (!isNaN(lNum) && !isNaN(rNum) && lNum !== rNum) {
                lClass = lNum > rNum ? 'higher' : 'lower';
                rClass = rNum > lNum ? 'higher' : 'lower';
              }
              const renderValue = (value: string | number | null | undefined) => {
                if (value == null) return '—';
                if (m.key === 'temp' || m.key === 'feels_like') return formatTemp(Number(value), unit);
                return `${value}${m.unit(unit)}`;
              };
              return (
                <tr key={m.key}>
                  <td className="compare-label">{m.label}</td>
                  <td className={`compare-value ${lClass}`}>{renderValue(lv)}</td>
                  <td className={`compare-value ${rClass}`}>{renderValue(rv)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}