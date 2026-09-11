import { useMemo } from 'react';
import type { WeatherType } from '../types';
import { getWeatherType } from '../services/helpers';

interface RainDropProps {
  delay: number;
  left: number;
  duration: number;
}

function RainDrop({ delay, left, duration }: RainDropProps) {
  return <div className="rain-drop" style={{ left: `${left}%`, animationDelay: `${delay}s`, animationDuration: `${duration}s` }} />;
}

interface SnowFlakeProps {
  delay: number;
  left: number;
  duration: number;
}

function SnowFlake({ delay, left, duration }: SnowFlakeProps) {
  return <div className="snow-flake" style={{ left: `${left}%`, animationDelay: `${delay}s`, animationDuration: `${duration}s` }} />;
}

interface SunRayProps {
  angle: number;
}

function SunRay({ angle }: SunRayProps) {
  return <div className="sun-ray" style={{ transform: `rotate(${angle}deg)` }} />;
}

interface CloudProps {
  delay: number;
  top: number;
  speed: number;
}

function Cloud({ delay, top, speed }: CloudProps) {
  return <div className="floating-cloud" style={{ top: `${top}%`, animationDelay: `${delay}s`, animationDuration: `${speed}s` }} />;
}

interface FogLayerProps {
  delay: number;
  top: number;
}

function FogLayer({ delay, top }: FogLayerProps) {
  return <div className="fog-layer" style={{ top: `${top}%`, animationDelay: `${delay}s`, animationDuration: `${15 + Math.random() * 10}s` }} />;
}

interface WeatherEffectsProps {
  iconCode: string;
}

export default function WeatherEffects({ iconCode }: WeatherEffectsProps) {
  const type: WeatherType = getWeatherType(iconCode);

  const particles = useMemo(() => {
    if (type === 'rain' || type === 'storm') {
      return Array.from({ length: type === 'storm' ? 80 : 40 }, (_, i) => ({
        id: i,
        delay: Math.random() * 2,
        left: Math.random() * 100,
        duration: 0.35 + Math.random() * 0.35,
      }));
    }
    if (type === 'snow') {
      return Array.from({ length: 40 }, (_, i) => ({
        id: i,
        delay: Math.random() * 5,
        left: Math.random() * 100,
        duration: 3 + Math.random() * 4,
      }));
    }
    return [];
  }, [type]);

  const rays = useMemo(() => {
    if (type !== 'clear') return [];
    return Array.from({ length: 12 }, (_, i) => i * 30);
  }, [type]);

  const clouds = useMemo(() => {
    if (type !== 'clouds' && type !== 'fog') return [];
    return Array.from({ length: 6 }, (_, i) => ({
      id: i,
      delay: Math.random() * 12,
      top: 8 + Math.random() * 55,
      speed: 18 + Math.random() * 16,
    }));
  }, [type]);

  const fogLayers = useMemo(() => {
    if (type !== 'fog') return [];
    return Array.from({ length: 4 }, (_, i) => ({
      id: i,
      delay: i * 4,
      top: 25 + i * 15,
    }));
  }, [type]);

  if (type === 'rain' || type === 'storm') {
    return (
      <div className={`weather-effects ${type === 'storm' ? 'storm-bg' : 'rain-bg'}`}>
        {particles.map(p => <RainDrop key={p.id} {...p} />)}
        {type === 'storm' && <div className="lightning-flash" />}
      </div>
    );
  }

  if (type === 'snow') {
    return (
      <div className="weather-effects snow-bg">
        {particles.map(p => <SnowFlake key={p.id} {...p} />)}
      </div>
    );
  }

  if (type === 'clear') {
    return (
      <div className="weather-effects clear-bg">
        <div className="sun-glow" />
        {rays.map(a => <SunRay key={a} angle={a} />)}
      </div>
    );
  }

  if (type === 'clouds') {
    return (
      <div className="weather-effects clouds-bg">
        {clouds.map(c => <Cloud key={c.id} {...c} />)}
      </div>
    );
  }

  if (type === 'fog') {
    return (
      <div className="weather-effects fog-bg">
        {clouds.map(c => <Cloud key={c.id} {...c} />)}
        {fogLayers.map(f => <FogLayer key={f.id} {...f} />)}
      </div>
    );
  }

  return null;
}