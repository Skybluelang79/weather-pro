import { useState, useMemo } from 'react';
import { getWeatherIcon, formatTemp, getWindDirection } from '../services/helpers';

export default function Forecast({ data, unit }) {
  const [expandedHour, setExpandedHour] = useState(null);

  const days = useMemo(() => {
    if (!data || !data.list) return [];
    const daily = {};
    data.list.forEach(item => {
      const day = new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' });
      if (!daily[day]) {
        daily[day] = { temps: [], icons: [], descs: [], items: [] };
      }
      daily[day].temps.push(item.main.temp);
      daily[day].icons.push(item.weather[0].icon);
      daily[day].descs.push(item.weather[0].description);
      daily[day].items.push(item);
    });
    return Object.entries(daily).slice(0, 5);
  }, [data]);

  const globalMin = useMemo(() => {
    if (!days.length) return 0;
    return Math.min(...days.flatMap(([, info]) => info.temps));
  }, [days]);
  const globalMax = useMemo(() => {
    if (!days.length) return 0;
    return Math.max(...days.flatMap(([, info]) => info.temps));
  }, [days]);
  const range = globalMax - globalMin || 1;

  if (!data || !data.list) return null;

  return (
    <div className="forecast animate-slide-up">
      <h3 className="section-title">5-Day Forecast</h3>
      <div className="forecast-grid">
        {days.map(([day, info], i) => {
          const maxT = Math.max(...info.temps);
          const minT = Math.min(...info.temps);
          const noon = info.items.find(item => {
            const h = new Date(item.dt * 1000).getHours();
            return h >= 11 && h <= 14;
          }) || info.items[Math.floor(info.items.length / 2)];
          const icon = noon ? noon.weather[0].icon : info.icons[Math.floor(info.icons.length / 2)];
          const barWidth = ((maxT - minT) / range) * 100;

          return (
            <div key={day} className="forecast-card" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="forecast-day">{i === 0 ? 'Today' : day}</div>
              <div className="forecast-icon">{getWeatherIcon(icon)}</div>
              <div className="forecast-temps">
                <span className="forecast-max">{formatTemp(maxT, unit)}</span>
                <span className="forecast-min">{formatTemp(minT, unit)}</span>
              </div>
              <div className="forecast-temp-bar">
                <div className="forecast-temp-fill" style={{ width: `${Math.max(barWidth, 20)}%` }} />
              </div>
              <div className="forecast-desc">{noon ? noon.weather[0].description : ''}</div>
            </div>
          );
        })}
      </div>

      <h3 className="section-title" style={{ marginTop: 28 }}>Hourly</h3>
      <div className="hourly-scroll">
        {data.list.slice(0, 8).map((item, i) => {
          const time = new Date(item.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
          const isExpanded = expandedHour === i;
          return (
            <div
              key={i}
              className={`hourly-card ${isExpanded ? 'expanded' : ''}`}
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => setExpandedHour(isExpanded ? null : i)}
            >
              <div className="hourly-time">{time}</div>
              <div className="hourly-icon">{getWeatherIcon(item.weather[0].icon)}</div>
              <div className="hourly-temp">{formatTemp(item.main.temp, unit)}</div>
              {!isExpanded && <div className="hourly-wind">💨 {item.wind.speed}</div>}
              {isExpanded && (
                <div className="hourly-details">
                  <div className="hourly-detail">
                    <span>💧</span>
                    <span>{item.main.humidity}%</span>
                  </div>
                  <div className="hourly-detail">
                    <span>💨</span>
                    <span>{item.wind.speed} m/s {getWindDirection(item.wind.deg)}</span>
                  </div>
                  <div className="hourly-detail">
                    <span>🌡️</span>
                    <span>{item.main.pressure} hPa</span>
                  </div>
                  <div className="hourly-detail">
                    <span>👁️</span>
                    <span>{(item.visibility / 1000).toFixed(1)} km</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
