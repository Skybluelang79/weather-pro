import { useState, useEffect, useCallback } from 'react';
import SearchBar from './components/SearchBar';
import CurrentWeather from './components/CurrentWeather';
import Forecast from './components/Forecast';
import Favorites from './components/Favorites';
import AirQuality from './components/AirQuality';
import History from './components/History';
import WeatherEffects from './components/WeatherEffects';
import { api } from './services/api';
import { getWeatherGradient, getWeatherType } from './services/helpers';
import './App.css';

export default function App() {
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [air, setAir] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unit, setUnit] = useState('C');
  const [activeTab, setActiveTab] = useState('weather');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getFavorites().then(setFavorites).catch(() => {});
    api.getHistory().then(setHistory).catch(() => {});
    setTimeout(() => setLoaded(true), 100);
  }, []);

  const fetchAll = useCallback(async (params) => {
    setLoading(true);
    setError('');
    try {
      const [w, f] = await Promise.all([
        api.getCurrent(params),
        api.getForecast(params),
      ]);
      setWeather(w);
      setForecast(f);
      if (w.coord) {
        api.getAirQuality(w.coord.lat, w.coord.lon).then(setAir).catch(() => {});
      }
      api.getHistory().then(setHistory).catch(() => {});
    } catch (err) {
      setError(err.message || 'Failed to fetch weather');
      setWeather(null);
      setForecast(null);
      setAir(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (city) => {
    fetchAll({ city, units: unit === 'F' ? 'imperial' : 'metric' });
  };

  const handleLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    setError('Getting location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchAll({ lat: pos.coords.latitude, lon: pos.coords.longitude, units: unit === 'F' ? 'imperial' : 'metric' });
      },
      () => setError('Location access denied. Please search by city name.')
    );
  };

  const handleToggleUnit = () => {
    const next = unit === 'C' ? 'F' : 'C';
    setUnit(next);
    if (weather) {
      const params = weather.coord
        ? { lat: weather.coord.lat, lon: weather.coord.lon }
        : { city: weather.name };
      params.units = next === 'F' ? 'imperial' : 'metric';
      fetchAll(params);
    }
  };

  const handleFavorite = async () => {
    if (!weather) return;
    const existing = favorites.find(f => f.city.toLowerCase() === weather.name.toLowerCase());
    if (existing) {
      await api.removeFavorite(existing.id);
    } else {
      await api.addFavorite({ city: weather.name, country: weather.sys.country, lat: weather.coord.lat, lon: weather.coord.lon });
    }
    const favs = await api.getFavorites();
    setFavorites(favs);
  };

  const handleFavClick = (fav) => {
    fetchAll({ city: fav.city, units: unit === 'F' ? 'imperial' : 'metric' });
    setActiveTab('weather');
  };

  const handleRemoveFav = async (id) => {
    await api.removeFavorite(id);
    setFavorites(await api.getFavorites());
  };

  const handleRemoveHistory = async (id) => {
    await api.removeHistory(id);
    setHistory(await api.getHistory());
  };

  const handleClearHistory = async () => {
    await api.clearHistory();
    setHistory([]);
  };

  const isFav = weather ? favorites.some(f => f.city.toLowerCase() === weather.name.toLowerCase()) : false;
  const weatherType = weather ? getWeatherType(weather.weather[0].icon) : 'clear';
  const isDay = weather ? weather.weather[0].icon.includes('d') : true;
  const gradient = getWeatherGradient(weatherType, isDay);

  return (
    <div className={`app ${loaded ? 'loaded' : ''}`} style={{ backgroundImage: gradient }}>
      {weather && <WeatherEffects iconCode={weather.weather[0].icon} />}

      <div className="app-content">
        <header className="app-header">
          <div className="logo">
            <span className="logo-icon">🌍</span>
            <span className="logo-text">WeatherPro</span>
          </div>
          <button className="location-btn" onClick={handleLocation} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
            </svg>
            My Location
          </button>
        </header>

        <SearchBar onSearch={handleSearch} loading={loading} />

        {error && (
          <div className={`error-toast ${error.includes('Getting') ? 'info' : ''}`}>
            {error}
          </div>
        )}

        <div className="tabs">
          {['weather', 'forecast', 'favorites', 'history'].map(tab => (
            <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab === 'weather' && '☀️'} {tab === 'forecast' && '📅'} {tab === 'favorites' && '❤️'} {tab === 'history' && '🕐'}
              <span className="tab-label">{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
            </button>
          ))}
        </div>

        <main className="main-content">
          {loading && (
            <div className="loading-overlay">
              <div className="loader">
                <div className="loader-ring" />
                <div className="loader-ring" />
                <div className="loader-ring" />
              </div>
            </div>
          )}

          {activeTab === 'weather' && weather && (
            <>
              <CurrentWeather
                data={weather}
                unit={unit}
                onToggleUnit={handleToggleUnit}
                onFavorite={handleFavorite}
                isFav={isFav}
              />
              {air && <AirQuality data={air} />}
            </>
          )}

          {activeTab === 'forecast' && forecast && (
            <Forecast data={forecast} unit={unit} />
          )}

          {activeTab === 'favorites' && (
            <Favorites favorites={favorites} onClick={handleFavClick} onRemove={handleRemoveFav} />
          )}

          {activeTab === 'history' && (
            <History history={history} onSearch={handleSearch} onRemove={handleRemoveHistory} onClear={handleClearHistory} />
          )}

          {!loading && activeTab === 'weather' && !weather && !error && (
            <div className="empty-hero">
              <div className="empty-icon">🌤️</div>
              <h2>Welcome to WeatherPro</h2>
              <p>Search for a city or use your current location to get started</p>
              <button className="cta-btn" onClick={handleLocation}>
                Use My Location
              </button>
            </div>
          )}

          {activeTab === 'favorites' && favorites.length === 0 && !loading && (
            <div className="empty-hero">
              <div className="empty-icon">❤️</div>
              <h2>No favorites yet</h2>
              <p>Search for a city and tap the heart icon to save it here</p>
            </div>
          )}

          {activeTab === 'history' && history.length === 0 && !loading && (
            <div className="empty-hero">
              <div className="empty-icon">🕐</div>
              <h2>No search history</h2>
              <p>Your recent searches will appear here</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
