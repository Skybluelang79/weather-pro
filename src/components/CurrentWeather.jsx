import { getWeatherIcon, formatTemp, formatTime, getWindDirection } from '../services/helpers';

function WindCompass({ deg, speed }) {
  return (
    <div className="detail-card">
      <div className="wind-compass">
        <div className="wind-compass-ring">
          <div
            className="wind-compass-needle"
            style={{ transform: `translate(-50%, -100%) rotate(${deg}deg)` }}
          />
          <div className="wind-compass-center" />
        </div>
        <span className="wind-compass-label n">N</span>
        <span className="wind-compass-label s">S</span>
        <span className="wind-compass-label e">E</span>
        <span className="wind-compass-label w">W</span>
      </div>
      <div className="detail-value">{speed} m/s</div>
      <div className="detail-label">{getWindDirection(deg)} Wind</div>
    </div>
  );
}

export default function CurrentWeather({ data, unit, onToggleUnit, onFavorite, isFav }) {
  if (!data) return null;

  const icon = data.weather[0].icon;

  return (
    <div className="current-weather animate-slide-up">
      <div className="current-top">
        <div className="current-location">
          <h2 className="current-city">{data.name}, {data.sys.country}</h2>
          <p className="current-date">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button className={`fav-btn ${isFav ? 'active' : ''}`} onClick={onFavorite} title={isFav ? 'Remove from favorites' : 'Add to favorites'}>
          <svg viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <div className="current-main">
        <div className="current-icon-wrap">
          <span className="current-icon">{getWeatherIcon(icon)}</span>
        </div>
        <div className="current-temp-wrap">
          <span className="current-temp">{formatTemp(data.main.temp, unit)}</span>
          <button className="unit-toggle" onClick={onToggleUnit}>
            {unit === 'C' ? '°F' : '°C'}
          </button>
        </div>
      </div>

      <p className="current-desc">{data.weather[0].description}</p>
      <p className="current-feels">Feels like {formatTemp(data.main.feels_like, unit)}</p>

      <div className="current-details">
        <div className="detail-card">
          <div className="detail-icon">💧</div>
          <div className="detail-value">{data.main.humidity}%</div>
          <div className="detail-label">Humidity</div>
        </div>
        <WindCompass deg={data.wind.deg} speed={data.wind.speed} />
        <div className="detail-card">
          <div className="detail-icon">👁️</div>
          <div className="detail-value">{(data.visibility / 1000).toFixed(1)} km</div>
          <div className="detail-label">Visibility</div>
        </div>
        <div className="detail-card">
          <div className="detail-icon">🌡️</div>
          <div className="detail-value">{data.main.pressure}</div>
          <div className="detail-label">Pressure hPa</div>
        </div>
      </div>

      <div className="current-sun">
        <div className="sun-item">
          <span className="sun-icon">🌅</span>
          <span className="sun-label">Sunrise</span>
          <span className="sun-time">{formatTime(data.sys.sunrise, data.timezone)}</span>
        </div>
        <div className="sun-divider" />
        <div className="sun-item">
          <span className="sun-icon">🌇</span>
          <span className="sun-label">Sunset</span>
          <span className="sun-time">{formatTime(data.sys.sunset, data.timezone)}</span>
        </div>
      </div>
    </div>
  );
}
