import { useState, useEffect, useCallback, useRef } from 'react';
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
import PremiumForecast from './components/PremiumForecast';
import AIAssistant from './components/AIAssistant';
import AlertRules from './components/AlertRules';
import WeatherMap from './components/WeatherMap';
import Pricing from './components/Pricing';
import UpgradeCard from './components/UpgradeCard';
import AuthModal from './components/AuthModal';
import NotificationInbox from './components/NotificationInbox';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/auth';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { useSubscription } from './context/subscription';
import type { WeatherData, ForecastData, AirQualityData, Favorite, HistoryEntry } from './types';
import './App.css';

function getInitialTheme(): string {
  const saved = localStorage.getItem('weatherpro-theme');
  if (saved) return saved;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'auto';
  return 'auto';
}

const TABS = ['weather', 'forecast', 'maps', 'ai', 'alerts', 'favorites', 'history', 'plans'];

const TAB_ICONS: Record<string, string> = {
  weather: '☀️', forecast: '📅', maps: '🗺️', ai: '✦', alerts: '🔔', favorites: '❤️', history: '🕐', plans: '👑',
};

function AppInner() {
  const { addToast } = useToast();
  const { user, logout } = useAuth();
  const { plan, hasFeature, maxFavorites, maxHistory, loading: subscriptionLoading } = useSubscription();
  const alertsEnabled = hasFeature('customAlerts');
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
  const [authOpen, setAuthOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [compareWeather, setCompareWeather] = useState<WeatherData | null>(null);
  const requestId = useRef(0);
  const goToPlans = () => setActiveTab('plans');
  const handleLogout = async () => {
    try {
      await logout();
      addToast('Signed out', 'info');
    } catch {
      addToast('Could not sign out', 'error');
    }
  };

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
    if (!alertsEnabled) {
      setUnreadCount(0);
      return undefined;
    }
    let active = true;
    const updateUnread = () => {
      api.getNotificationSummary()
        .then(summary => { if (active) setUnreadCount(summary.unread); })
        .catch(() => {});
    };
    updateUnread();
    const timer = window.setInterval(updateUnread, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [alertsEnabled, user?.id]);

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
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (showMap) {
          setShowMap(false);
          return;
        }
        const input = document.querySelector<HTMLInputElement>('.search-input');
        if (input) { input.value = ''; input.blur(); }
        return;
      }

      if (showMap) return;
      const num = Number(e.key);
      if (Number.isInteger(num) && num >= 1 && num <= TABS.length) setActiveTab(TABS[num - 1]);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMap]);

  const fetchAll = useCallback(async (params: Record<string, string>, recordAs?: string, preserveCompare = false) => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const [w, f] = await Promise.all([
        api.getCurrent(params),
        api.getForecast(params),
      ]);
      if (id !== requestId.current) return;
      setWeather(w);
      setForecast(f);
      if (!preserveCompare) setCompareWeather(null);
      setAir(null);
      if (w.coord) {
        api.getAirQuality(w.coord.lat, w.coord.lon)
          .then((data) => { if (id === requestId.current) setAir(data); })
          .catch(() => {});
      }
      if (recordAs) {
        api.recordHistory({ city: w.name || recordAs, country: w.sys?.country })
          .then((result) => { if (id === requestId.current) setHistory(result.searchHistory); })
          .catch(() => {});
      }
    } catch (err) {
      if (id !== requestId.current) return;
      setError((err as Error).message || 'Failed to fetch weather');
      setWeather(null);
      setForecast(null);
      setAir(null);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  const handleSearch = (city: string) => {
    fetchAll({ city }, city);
  };

  const handleLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    setError('Getting location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchAll({ lat: String(pos.coords.latitude), lon: String(pos.coords.longitude) });
      },
      () => setError('Location access denied. Please search by city name.')
    );
  };

  const handlePickLocation = (coords: { lat: number; lon: number }) => {
    setShowMap(false);
    fetchAll({ lat: String(coords.lat), lon: String(coords.lon) }, '__map__');
    setActiveTab('weather');
  };

  const closeInbox = () => {
    setInboxOpen(false);
    if (!alertsEnabled) return;
    api.getNotificationSummary()
      .then(summary => setUnreadCount(summary.unread))
      .catch(() => {});
  };

  const handleCompareCity = async (city: string) => {
    if (!city.trim()) return;
    try {
      const w = await api.getCompareWeather(city.trim());
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
      fetchAll(params);
    }
  };

  const handleFavorite = async () => {
    if (!weather) return;
    const existing = favorites.find(f => f.city.toLowerCase() === weather.name.toLowerCase());
    try {
      if (existing) {
        await api.removeFavorite(existing.id);
        addToast(`${weather.name} removed from favorites`, 'info');
      } else {
        if (favorites.length >= maxFavorites) {
          addToast(`The Basic plan saves up to ${maxFavorites} locations. Upgrade for unlimited favorites.`, 'error');
          goToPlans();
          return;
        }
        await api.addFavorite({
          city: weather.name,
          country: weather.sys?.country,
          lat: weather.coord?.lat,
          lon: weather.coord?.lon,
        });
        addToast(`${weather.name} added to favorites`, 'success');
      }
      setFavorites(await api.getFavorites());
    } catch {
      addToast('Could not update favorites', 'error');
    }
  };

  const handleFavClick = (fav: Favorite) => {
    fetchAll({ city: fav.city }, fav.city);
    setActiveTab('weather');
  };

  const handleRemoveFav = async (id: string) => {
    try {
      await api.removeFavorite(id);
      setFavorites(await api.getFavorites());
      addToast('Removed from favorites', 'info');
    } catch {
      addToast('Could not remove favorite', 'error');
    }
  };

  const handleRemoveHistory = async (id: string) => {
    try {
      await api.removeHistory(id);
      setHistory(await api.getHistory());
    } catch {
      addToast('Could not remove history entry', 'error');
    }
  };

  const handleClearHistory = async () => {
    try {
      await api.clearHistory();
      setHistory([]);
      addToast('Search history cleared', 'info');
    } catch {
      addToast('Could not clear history', 'error');
    }
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
            {alertsEnabled && !subscriptionLoading && (
              <button
                className="inbox-btn"
                onClick={() => setInboxOpen(true)}
                aria-label={`Weather alerts${unreadCount ? `, ${unreadCount} unread` : ''}`}
              >
                <span aria-hidden="true">🔔</span>
                {unreadCount > 0 && <span className="inbox-badge" aria-hidden="true">{unreadCount}</span>}
              </button>
            )}
            <button className="plan-badge-btn" onClick={goToPlans} title="Subscription plans" aria-label="Subscription plans">
              <span>👑</span>
              <span>{plan === 'premium' ? 'Premium' : plan === 'pro' ? 'Pro' : 'Free'}</span>
            </button>
            {user ? (
              <div className="auth-user">
                <span className="auth-user-name" title={user.email}>{user.name}</span>
                <button className="auth-logout" onClick={handleLogout}>Log out</button>
              </div>
            ) : (
              <button className="auth-open" onClick={() => setAuthOpen(true)}>Sign in</button>
            )}
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

        <SearchChips history={history.slice(0, maxHistory)} onSelect={handleSearch} />

        {error && (
          <div className={`error-toast ${error.includes('Getting') ? 'info' : ''}`} role={error.includes('Getting') ? 'status' : 'alert'}>
            {error}
          </div>
        )}

        <div className="tabs" role="tablist" aria-label="Weather sections">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              id={`tab-${tab}`}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls="weather-panel"
              aria-label={tab}
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => setActiveTab(tab)}
              onKeyDown={(event) => {
                const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                if (!step) return;
                event.preventDefault();
                const next = (i + step + TABS.length) % TABS.length;
                setActiveTab(TABS[next]);
                document.getElementById(`tab-${TABS[next]}`)?.focus();
              }}
            >
              {TAB_ICONS[tab]}
              <span className="tab-label">{tab === 'ai' ? 'AI' : tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
              <span className="tab-shortcut">{i + 1}</span>
            </button>
          ))}
        </div>

        <main className="main-content" id="weather-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`} tabIndex={0}>
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
              {!subscriptionLoading && hasFeature('multiCityCompare') ? (
                <>
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
              ) : !subscriptionLoading ? (
                <UpgradeCard
                  title="Compare Multiple Cities"
                  description="Compare temperatures, rain and wind across cities side by side."
                  requiredPlan="pro"
                  onUpgrade={goToPlans}
                />
              ) : null}
            </>
          )}

          {!loading && activeTab === 'forecast' && forecast && (
            <>
              <Forecast data={forecast} unit={unit} />
              <TempGraph data={forecast} unit={unit} />
            </>
          )}

          {!loading && !subscriptionLoading && activeTab === 'forecast' && weather?.coord && (
            hasFeature('extendedForecast') ? (
              <PremiumForecast
                lat={weather.coord.lat}
                lon={weather.coord.lon}
                city={weather.name}
                unit={unit}
              />
            ) : (
              <UpgradeCard
                title="14 & 30-Day Advanced Forecasts"
                description="Unlock hourly rainfall predictions, wind intelligence, 14-day forecasts and lower-confidence 30-day climate trends."
                requiredPlan="pro"
                onUpgrade={goToPlans}
              />
            )
          )}

          {activeTab === 'maps' && !subscriptionLoading && (
            <WeatherMap
              lat={weather?.coord?.lat}
              lon={weather?.coord?.lon}
              city={weather?.name || ''}
              onUpgrade={goToPlans}
            />
          )}

          {activeTab === 'ai' && !subscriptionLoading && (
            weather?.coord ? (
              <AIAssistant
                lat={weather.coord.lat}
                lon={weather.coord.lon}
                city={weather.name}
                unit={unit}
                onUpgrade={goToPlans}
              />
            ) : (
              <div className="empty-hero">
                <div className="empty-icon">✦</div>
                <h2>Ask the weather assistant</h2>
                <p>Search for a city first, then get practical weather guidance.</p>
              </div>
            )
          )}

          {activeTab === 'alerts' && !subscriptionLoading && (
            <AlertRules
              lat={weather?.coord?.lat}
              lon={weather?.coord?.lon}
              city={weather?.name || ''}
              unit={unit}
              onUpgrade={goToPlans}
            />
          )}

          {activeTab === 'plans' && <Pricing />}

          {activeTab === 'favorites' && (
            <Favorites favorites={favorites} onClick={handleFavClick} onRemove={handleRemoveFav} />
          )}

          {activeTab === 'history' && (
            <History history={history.slice(0, maxHistory)} onSearch={handleSearch} onRemove={handleRemoveHistory} onClear={handleClearHistory} />
          )}
          {activeTab === 'history' && !hasFeature('weatherHistory') && history.length > maxHistory && (
            <div className="history-upgrade-note">
              Showing your {maxHistory} most recent searches. <button onClick={goToPlans}>Unlock full history</button>
            </div>
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
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
        <NotificationInbox
          open={inboxOpen}
          onClose={closeInbox}
          onGoToAlerts={() => setActiveTab('alerts')}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <AppInner />
          </SubscriptionProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}