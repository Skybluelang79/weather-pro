import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../services/api';
import { useSubscription } from '../context/subscription';
import { useToast } from './Toast';
import UpgradeCard from './UpgradeCard';
import type { RadarFrame, WeatherMapsData } from '../types';

type LayerId = 'radar' | 'satellite' | 'temperature' | 'wind' | 'air';

const LAYERS: Array<{ id: LayerId; label: string }> = [
  { id: 'radar', label: 'Rain radar' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'temperature', label: 'Temperature' },
  { id: 'wind', label: 'Wind' },
  { id: 'air', label: 'Air quality' },
];

interface WeatherMapProps {
  lat?: number;
  lon?: number;
  city: string;
  onUpgrade: () => void;
}

export default function WeatherMap({ lat, lon, city, onUpgrade }: WeatherMapProps) {
  const { hasFeature } = useSubscription();
  const { addToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [maps, setMaps] = useState<WeatherMapsData | null>(null);
  const [layer, setLayer] = useState<LayerId>('radar');
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const loadMaps = useCallback(async () => {
    try {
      const data = await api.getWeatherMaps();
      setMaps(data);
      setFrameIndex(Math.max(0, data.radar.past.length + data.radar.nowcast.length - 1));
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Radar metadata is temporarily unavailable');
    }
  }, []);

  useEffect(() => {
    if (!hasFeature('weatherMaps') || !containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView([lat || 20, lon || 0], lat === undefined ? 2 : 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markerRef.current = null;
    };
  }, [hasFeature, lat, lon]);

  useEffect(() => {
    if (hasFeature('weatherMaps')) loadMaps().catch(() => {});
  }, [hasFeature, loadMaps]);

  const frames = useMemo<RadarFrame[]>(() => {
    if (!maps) return [];
    if (layer === 'radar') return [...maps.radar.past, ...maps.radar.nowcast];
    if (layer === 'satellite') return maps.satellite.infrared;
    return [];
  }, [maps, layer]);

  useEffect(() => {
    if (frames.length && frameIndex >= frames.length) setFrameIndex(frames.length - 1);
  }, [frames.length, frameIndex]);

  const tileUrl = useMemo(() => {
    if (layer === 'radar' || layer === 'satellite') {
      const frame = frames[frameIndex];
      if (!frame || !maps) return '';
      return `${maps.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
    }
    return `/api/tiles/${layer}/{z}/{x}/{y}`;
  }, [layer, frames, frameIndex, maps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileUrl) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const animated = layer === 'radar' || layer === 'satellite';
    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: animated ? 12 : 18,
      opacity: animated ? 0.8 : 0.65,
      attribution: animated ? 'RainViewer' : 'OpenWeatherMap',
    });
    tileLayerRef.current.addTo(map);
    return () => {
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
        tileLayerRef.current = null;
      }
    };
  }, [tileUrl, layer, lat, lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat === undefined || lon === undefined) return;
    if (markerRef.current) map.removeLayer(markerRef.current);
    markerRef.current = L.marker([lat, lon], {
      icon: L.divIcon({ className: 'weather-map-pin', html: '📍', iconSize: [32, 32], iconAnchor: [16, 30] }),
    }).addTo(map);
    map.setView([lat, lon], Math.max(map.getZoom(), 6));
  }, [lat, lon]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = window.setInterval(() => setFrameIndex(index => (index + 1) % frames.length), 700);
    return () => window.clearInterval(timer);
  }, [playing, frames.length]);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const results = await api.geocode(query.trim());
      const place = results[0];
      const map = mapRef.current;
      if (!place || !map) {
        addToast('Location not found', 'error');
        return;
      }
      map.setView([place.lat, place.lon], 8);
      if (markerRef.current) map.removeLayer(markerRef.current);
      markerRef.current = L.marker([place.lat, place.lon], {
        icon: L.divIcon({ className: 'weather-map-pin', html: '📍', iconSize: [32, 32], iconAnchor: [16, 30] }),
      }).addTo(map);
      addToast(`Showing ${place.name}`, 'success');
    } catch (err) {
      addToast((err as Error).message || 'Map search failed', 'error');
    } finally {
      setSearching(false);
    }
  };

  if (!hasFeature('weatherMaps')) {
    return (
      <UpgradeCard
        title="Advanced Weather Maps"
        description="Track live rain radar, satellite cloud cover, temperature, wind and air-quality layers. Scrub through the last two hours of radar frames to see where the rain is heading."
        onUpgrade={onUpgrade}
      />
    );
  }

  const frame = frames[frameIndex];
  const frameLabel = frame
    ? new Date(frame.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
    : '';

  return (
    <section className="map-panel animate-slide-up">
      <div className="glass-panel map-controls">
        <div className="section-title">Weather Maps <span className="pro-chip">PRO</span></div>
        <p className="premium-subtitle">Live radar and modeled layers for {city || 'the selected location'}.</p>
        <form className="map-search" onSubmit={search}>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search another location" aria-label="Search map location" />
          <button type="submit" disabled={searching || !query.trim()}>{searching ? '…' : 'Go'}</button>
        </form>
        <div className="layer-switcher" role="group" aria-label="Map layer">
          {LAYERS.map(item => (
            <button key={item.id} className={layer === item.id ? 'active' : ''} onClick={() => { setLayer(item.id); setFrameIndex(0); }}>
              {item.label}
            </button>
          ))}
        </div>
        {frames.length > 0 && (
          <div className="map-timeline">
            <button onClick={() => setPlaying(value => !value)} aria-label={playing ? 'Pause radar' : 'Play radar'}>
              {playing ? '❚❚' : '▶'}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, frames.length - 1)}
              value={Math.min(frameIndex, frames.length - 1)}
              onChange={event => setFrameIndex(Number(event.target.value))}
              aria-label="Radar frame"
            />
            <span>{frameLabel} UTC</span>
          </div>
        )}
        {layer === 'satellite' && frames.length === 0 && (
          <p className="premium-subtitle">Satellite imagery is temporarily unavailable. Try rain radar instead.</p>
        )}
        {(layer === 'temperature' || layer === 'wind' || layer === 'air') && (
          <p className="premium-subtitle">Modeled {LAYERS.find(item => item.id === layer)?.label.toLowerCase()} layer from OpenWeatherMap.</p>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
      <div className="weather-map-canvas" ref={containerRef} />
    </section>
  );
}
