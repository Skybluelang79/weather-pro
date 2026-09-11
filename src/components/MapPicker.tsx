import { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../services/api';

interface MapPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (coords: { lat: number; lon: number }) => void;
  loading: boolean;
}

export default function MapPicker({ open, onClose, onPick, loading }: MapPickerProps) {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [place, setPlace] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!open) return;

    const map = L.map(containerRef.current!, { zoomControl: true }).setView([20, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const icon = L.divIcon({
      className: 'map-pin',
      html: '📍',
      iconSize: [32, 32],
      iconAnchor: [16, 30],
    });

    const handleClick = (e: any) => {
      const lat = Number(e.latlng.lat.toFixed(4));
      const lon = Number(e.latlng.lng.toFixed(4));
      setCoords({ lat, lon });
      if (markerRef.current) markerRef.current.setLatLng(e.latlng);
      else markerRef.current = L.marker(e.latlng, { icon, draggable: true }).addTo(map);
      markerRef.current.on('dragend', (ev: any) => {
        const p = ev.target.getLatLng();
        setCoords({ lat: Number(p.lat.toFixed(4)), lon: Number(p.lng.toFixed(4)) });
      });
    };

    map.on('click', handleClick);
    mapRef.current = map;

    return () => {
      map.off('click', handleClick);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!coords || !open) {
      setPlace('');
      return;
    }
    let cancelled = false;
    setResolving(true);
    api.reverseGeocode(coords.lat, coords.lon)
      .then((results) => {
        if (cancelled) return;
        const top = results[0];
        if (top) {
          const name = top.name || 'Selected point';
          const region = [top.state, top.country].filter(Boolean).join(', ');
          setPlace(region ? `${name}, ${region}` : name);
        } else {
          setPlace(`${coords.lat.toFixed(2)}, ${coords.lon.toFixed(2)}`);
        }
      })
      .catch(() => {
        if (!cancelled) setPlace(`${coords.lat.toFixed(2)}, ${coords.lon.toFixed(2)}`);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => { cancelled = true; };
  }, [coords, open]);

  if (!open) return null;

  const handleUse = () => {
    if (coords) onPick(coords);
  };

  return (
    <div className="map-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="map-modal">
        <div className="map-header">
          <h3>Pick a location on the map</h3>
          <button className="map-close" onClick={onClose} aria-label="Close map">✕</button>
        </div>
        <div className="map-canvas" ref={containerRef} />
        <div className="map-footer">
          <div className="map-place">
            {resolving ? <span className="spinner" /> : coords ? (
              <>
                <span className="map-location">{place}</span>
                <span className="map-coords">{coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}</span>
              </>
            ) : (
              <span className="map-hint">Click anywhere on the map to choose a location</span>
            )}
          </div>
          <button className="map-use-btn" onClick={handleUse} disabled={!coords || loading || resolving}>
            {loading ? <span className="spinner" /> : 'Show Weather'}
          </button>
        </div>
      </div>
    </div>
  );
}