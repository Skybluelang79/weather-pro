import { useEffect, useMemo, useState } from 'react';
import type { PremiumForecastData } from '../types';
import { api } from '../services/api';
import { getWeatherIcon, getWindDirection } from '../services/helpers';
import { useSubscription } from '../context/subscription';

interface PremiumForecastProps {
  lat: number;
  lon: number;
  city: string;
  unit: string;
}

type Range = 'hourly' | '7' | '14' | '30';

export default function PremiumForecast({ lat, lon, city, unit }: PremiumForecastProps) {
  const { maxForecastDays, hasFeature } = useSubscription();
  const [data, setData] = useState<PremiumForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [range, setRange] = useState<Range>('7');

  const allowedDays = Math.min(maxForecastDays, 30);
  const ranges = useMemo<Range[]>(() => {
    const options: Range[] = ['hourly', '7'];
    if (allowedDays >= 14) options.push('14');
    if (allowedDays >= 30) options.push('30');
    return options;
  }, [allowedDays]);

  useEffect(() => {
    if (!ranges.includes(range)) setRange(ranges[ranges.length - 1]);
  }, [ranges, range]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.getPremiumForecast({
      lat,
      lon,
      city,
      days: allowedDays,
      units: unit === 'F' ? 'imperial' : 'metric',
    })
      .then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err.message || 'Could not load the extended forecast'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [lat, lon, city, allowedDays, unit]);

  const fmt = (value: number) => `${Math.round(value || 0)}°${unit}`;
  const daysToShow = range === 'hourly' ? 0 : Number(range);
  const days = (data?.daily || []).slice(0, daysToShow);
  const hours = (data?.hourly || []).slice(0, 24);
  const today = data?.daily?.[0];
  const maxGust = Math.max(0, ...(data?.hourly || []).slice(0, 24).map(h => h.windGust || 0));
  const totalRain = days.reduce((sum, day) => sum + (day.precipSum || 0), 0);

  const hourLabel = (time: string) => {
    const hour = Number(time.slice(11, 13));
    return `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`;
  };

  return (
    <section className="premium-forecast glass-panel animate-slide-up">
      <div className="premium-heading">
        <div>
          <div className="section-title">Advanced Forecast <span className="pro-chip">PRO</span></div>
          <p className="premium-subtitle">{data?.location?.name || city} · high-detail model data</p>
        </div>
        <div className="range-switch">
          {ranges.map(option => (
            <button
              key={option}
              className={`range-btn ${range === option ? 'active' : ''}`}
              onClick={() => setRange(option)}
            >
              {option === 'hourly' ? '24 hours' : `${option} days`}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="premium-loading">Loading extended forecast…</div>}
      {error && <div className="premium-error">{error}</div>}

      {!loading && !error && data && (
        <>
          {range === '30' && (
            <div className="confidence-notice">
              <strong>Lower-confidence outlook.</strong> Days 17–30 use last year's climate baseline for these dates and are
              marked <span className="confidence-badge low">LOW CONFIDENCE</span>. Treat them as trends, not precise predictions.
            </div>
          )}

          {range === 'hourly' ? (
            <div className="premium-hourly">
              {hours.map((hour, i) => (
                <div key={hour.time} className="premium-hour" style={{ animationDelay: `${i * 0.03}s` }}>
                  <span className="premium-hour-time">{hourLabel(hour.time)}</span>
                  <span className="premium-hour-icon">{getWeatherIcon(hour.icon)}</span>
                  <strong>{fmt(hour.temp)}</strong>
                  <span className="premium-hour-rain">💧 {Math.round(hour.precipProbability)}%</span>
                  <span className="premium-hour-wind">💨 {Math.round(hour.windGust)} {data.units === 'imperial' ? 'mph' : 'km/h'}</span>
                  <span className="premium-hour-desc">{hour.description}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="premium-daily">
              {days.map((day, i) => (
                <div key={day.date} className="premium-day" style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="premium-day-top">
                    <span className="premium-day-name">{i === 0 ? 'Today' : day.dayLabel}</span>
                    <span className="premium-day-date">{day.date.slice(5)}</span>
                  </div>
                  <span className="premium-day-icon">{getWeatherIcon(day.icon)}</span>
                  <div className="premium-day-temps">
                    <strong>{fmt(day.tempMax)}</strong>
                    <span>{fmt(day.tempMin)}</span>
                  </div>
                  <div className="premium-day-desc">{day.description}</div>
                  <div className="premium-rain-row">
                    <span>🌧️ {Math.round(day.precipProbability)}%</span>
                    <div className="premium-rain-track">
                      <div className="premium-rain-fill" style={{ width: `${Math.min(100, day.precipProbability)}%` }} />
                    </div>
                  </div>
                  <div className="premium-day-meta">
                    <span>💨 {Math.round(day.windGust)} {data.units === 'imperial' ? 'mph' : 'km/h'} {getWindDirection(day.windDeg)}</span>
                    <span>🌡️ feels {fmt(day.feelsMax)}</span>
                  </div>
                  {day.modeled && (
                    <span className="confidence-badge low">{day.source === 'climate' ? 'CLIMATE BASELINE' : 'PROJECTED'}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="premium-insights">
            <div className="premium-insight">
              <span className="insight-label">Rain total</span>
              <strong>{range === 'hourly' ? `${Math.round(hours[0]?.precipProbability || 0)}% chance now` : `${totalRain.toFixed(1)} ${data.units === 'imperial' ? 'in' : 'mm'}`}</strong>
              <span className="insight-note">{range === 'hourly' ? 'next hour' : `across ${daysToShow} days`}</span>
            </div>
            <div className="premium-insight">
              <span className="insight-label">Wind intelligence</span>
              <strong>{Math.round(maxGust)} {data.units === 'imperial' ? 'mph' : 'km/h'}</strong>
              <span className="insight-note">peak gust · next 24h</span>
            </div>
            <div className="premium-insight">
              <span className="insight-label">Sun</span>
              <strong>{today?.sunrise ? today.sunrise.slice(11, 16) : '—'} / {today?.sunset ? today.sunset.slice(11, 16) : '—'}</strong>
              <span className="insight-note">sunrise / sunset</span>
            </div>
            {hasFeature('climateAnalytics') && (
              <div className="premium-insight">
                <span className="insight-label">UV index</span>
                <strong>{Math.round(today?.uvIndex || 0)}</strong>
                <span className="insight-note">today's peak</span>
              </div>
            )}
          </div>

          <p className="premium-disclaimer">{data.disclaimer}</p>
        </>
      )}
    </section>
  );
}
