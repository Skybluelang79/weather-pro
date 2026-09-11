import { useState, useEffect, useCallback } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import SearchBar from './components/SearchBar';
import CurrentWeather from './components/CurrentWeather';
import Forecast from './components/Forecast';
import Favorites from './components/Favorites';
import AirQuality from './components/AirQuality';
import Alerts from './components/Alerts';
import History from './components/History';
import WeatherEffects from './components/WeatherEffects';
import SunArc from './components/SunArc';
import MapPicker from './components/MapPicker';
import Footer from './components/Footer';
import SearchChips from './components/SearchChips';
import { SkeletonCurrentWeather, SkeletonForecast } from './components/Skeleton';
import { ToastProvider, useToast } from './components/Toast';
import { api } from './services/api';
import { getWeatherGradient, getWeatherType, generateFaviconSVG } from './services/helpers';
import TempGraph from './components/TempGraph';
import WeatherCompare from './components/WeatherCompare';
import type { WeatherData, ForecastData, AirQualityData, Favorite, HistoryEntry } from './types';
import './App.css';

function getInitialTheme(): string {
  const saved = localStorage.getItem('weatherpro-theme');
  if (saved) return saved;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'auto';
  return 'auto';
}

function AppInner() {
  const { addToast } = useToast();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [air, setAir] = useState<AirQualityData | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unit, setUnit] = useState(() => localStorage.getItem('weatherpro-unit') || 'C');
  const [activeTab, setActiveTab] = useState('weather');
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState<string>(getInitialTheme);
  const [showMap, setShowMap] = useState(false);
  const [compareWeather, setCompareWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('weatherpro-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('weatherpro-unit', unit);
  }, [unit]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const saved = localStorage.getItem('weatherpro-theme');
      if (!saved || saved === 'auto') {
        document.documentElement.setAttribute('data-theme', 'auto');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    api.getFavorites().then(setFavorites).catch(() => {});
    api.getHistory().then(setHistory).catch(() => {});
    setTimeout(() => setLoaded(true), 100);
  }, []);

  useEffect(() => {
    if (!weather) return;
    const iconCode = weather.weather[0].icon;
    const svg = generateFaviconSVG(iconCode);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
    return () => { URL.revokeObjectURL(url); };
  }, [weather]);

  useEffect(() => {
    const tabs = ['weather', 'forecast', 'favorites', 'history'];
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

      if (e.key === 'Escape') {
        const input = document.querySelector<HTMLInputElement>('.search-input');
        if (input) { input.value = ''; input.blur(); }
      }

      const num = parseInt(e.key);
      if (num >= 1 && num <= 4) {
        setActiveTab(tabs[num - 1]);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchAll = useCallback(async (params: Record<string, string>, recordAs?: string) => {
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
      if (recordAs) {
        api.recordHistory({ city: w.name || recordAs, country: w.sys?.country }).catch(() => {});
        api.getHistory().then(setHistory).catch(() => {});
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch weather');
      setWeather(null);
      setForecast(null);
      setAir(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (city: string) => {
    fetchAll({ city, units: unit === 'F' ? 'imperial' : 'metric' }, city);
  };

  const handleLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    setError('Getting location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchAll({ lat: String(pos.coords.latitude), lon: String(pos.coords.longitude), units: unit === 'F' ? 'imperial' : 'metric' });
      },
      () => setError('Location access denied. Please search by city name.')
    );
  };

  const handlePickLocation = (coords: { lat: number; lon: number }) => {
    setShowMap(false);
    fetchAll({ lat: String(coords.lat), lon: String(coords.lon), units: unit === 'F' ? 'imperial' : 'metric' }, '__map__');
    setActiveTab('weather');
  };

  const handleCompareCity = async (city: string) => {
    if (!city.trim()) return;
    try {
      const w = await api.getCurrent({ city: city.trim(), units: unit === 'F' ? 'imperial' : 'metric' });
      setCompareWeather(w);
      addToast(`Added ${w.name} for comparison`, 'success');
    } catch (err) {
      addToast((err as Error).message || 'Could not load comparison city', 'error');
    }
  };

  const handleToggleUnit = () => {
    const next = unit === 'C' ? 'F' : 'C';
    setUnit(next);
    addToast(`Switched to °${next}`, 'info');
    if (weather) {
      const params: Record<string, string> = weather.coord
        ? { lat: String(weather.coord.lat), lon: String(weather.coord.lon) }
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
      addToast(`${weather.name} removed from favorites`, 'info');
    } else {
      await api.addFavorite({ city: weather.name, country: weather.sys.country, lat: weather.coord.lat, lon: weather.coord.lon });
      addToast(`${weather.name} added to favorites`, 'success');
    }
    const favs = await api.getFavorites();
    setFavorites(favs);
  };

  const handleFavClick = (fav: Favorite) => {
    fetchAll({ city: fav.city, units: unit === 'F' ? 'imperial' : 'metric' }, fav.city);
    setActiveTab('weather');
  };

  const handleRemoveFav = async (id: string) => {
    await api.removeFavorite(id);
    setFavorites(await api.getFavorites());
    addToast('Removed from favorites', 'info');
  };

  const handleRemoveHistory = async (id: string) => {
    await api.removeHistory(id);
    setHistory(await api.getHistory());
  };

  const handleClearHistory = async () => {
    await api.clearHistory();
    setHistory([]);
    addToast('Search history cleared', 'info');
  };

  const cycleTheme = () => {
    const next = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
    setTheme(next);
    addToast(`Theme: ${next.charAt(0).toUpperCase() + next.slice(1)}`, 'info');
  };

  const themeIcon = theme === 'auto' ? '🌓' : theme === 'light' ? '☀️' : '🌙';
  const themeLabel = theme === 'auto' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark';

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
          <div className="header-actions">
            <button className="theme-btn" onClick={cycleTheme} title={`Theme: ${themeLabel}`}>
              <span>{themeIcon}</span>
            </button>
            <button className="location-btn" onClick={handleLocation} disabled={loading}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
              </svg>
              <span>My Location</span>
            </button>
            <button className="map-btn" onClick={() => setShowMap(true)} title="Pick location on map">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M9 20l-6-3V4l6 3 6-3 6 3v13l-6 3-6-3z" />
                <path d="M9 4v13m6-13v13" />
              </svg>
              <span>Map</span>
            </button>
          </div>
        </header>

        <SearchBar onSearch={handleSearch} loading={loading} />

        <SearchChips history={history} onSelect={handleSearch} />

        {error && (
          <div className={`error-toast ${error.includes('Getting') ? 'info' : ''}`}>
            {error}
          </div>
        )}

        <div className="tabs">
          {['weather', 'forecast', 'favorites', 'history'].map((tab, i) => (
            <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab === 'weather' && '☀️'} {tab === 'forecast' && '📅'} {tab === 'favorites' && '❤️'} {tab === 'history' && '🕐'}
              <span className="tab-label">{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
              <span className="tab-shortcut">{i + 1}</span>
            </button>
          ))}
        </div>

        <main className="main-content">
          {loading && activeTab === 'weather' && <SkeletonCurrentWeather />}
          {loading && activeTab === 'forecast' && <SkeletonForecast />}
          {loading && activeTab !== 'weather' && activeTab !== 'forecast' && (
            <div className="loading-overlay">
              <div className="loader">
                <div className="loader-ring" />
                <div className="loader-ring" />
                <div className="loader-ring" />
              </div>
            </div>
          )}

          {!loading && activeTab === 'weather' && weather && (
            <>
              <CurrentWeather
                data={weather}
                unit={unit}
                onToggleUnit={handleToggleUnit}
                onFavorite={handleFavorite}
                isFav={isFav}
              />
              {weather.sys && weather.sys.sunrise && (
                <SunArc
                  sunrise={weather.sys.sunrise}
                  sunset={weather.sys.sunset}
                  timezone={weather.timezone}
                />
              )}
              {weather.coord && <Alerts lat={weather.coord.lat} lon={weather.coord.lon} />}
              {air && <AirQuality data={air} />}
              <div className="compare-bar">
                <span className="compare-bar-label">Compare with:</span>
                <form className="compare-bar-form" onSubmit={(e) => { e.preventDefault(); const input = (e.target as HTMLFormElement).elements[0] as HTMLInputElement; handleCompareCity(input.value); e.target.reset(); }}>
                  <input type="text" placeholder="Another city..." className="compare-bar-input" />
                  <button type="submit" className="compare-bar-btn">+</button>
                </form>
              </div>
              {weather && compareWeather && (
                <WeatherCompare weatherA={weather} weatherB={compareWeather} unit={unit} />
              )}
            </>
          )}

          {!loading && activeTab === 'forecast' && forecast && (
            <>
              <Forecast data={forecast} unit={unit} />
              <TempGraph data={forecast} unit={unit} />
            </>
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

        <Footer />

        <MapPicker
          open={showMap}
          onClose={() => setShowMap(false)}
          onPick={handlePickLocation}
          loading={loading}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </ErrorBoundary>
  );
}