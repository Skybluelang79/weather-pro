import { getWeatherIcon, formatTemp } from '../services/helpers';

export default function Forecast({ data, unit }) {
  if (!data || !data.list) return null;

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

  const days = Object.entries(daily).slice(0, 5);

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

          return (
            <div key={day} className="forecast-card" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="forecast-day">{i === 0 ? 'Today' : day}</div>
              <div className="forecast-icon">{getWeatherIcon(icon)}</div>
              <div className="forecast-temps">
                <span className="forecast-max">{formatTemp(maxT, unit)}</span>
                <span className="forecast-min">{formatTemp(minT, unit)}</span>
              </div>
              <div className="forecast-desc">{noon ? noon.weather[0].description : ''}</div>
            </div>
          );
        })}
      </div>

      <h3 className="section-title" style={{ marginTop: 24 }}>Hourly</h3>
      <div className="hourly-scroll">
        {data.list.slice(0, 8).map((item, i) => {
          const time = new Date(item.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
          return (
            <div key={i} className="hourly-card" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="hourly-time">{time}</div>
              <div className="hourly-icon">{getWeatherIcon(item.weather[0].icon)}</div>
              <div className="hourly-temp">{formatTemp(item.main.temp, unit)}</div>
              <div className="hourly-wind">💨 {item.wind.speed}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
