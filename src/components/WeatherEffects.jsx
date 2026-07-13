import { useMemo } from 'react';
import { getWeatherType } from '../services/helpers';

function RainDrop({ delay, left, duration }) {
  return <div className="rain-drop" style={{ left: `${left}%`, animationDelay: `${delay}s`, animationDuration: `${duration}s` }} />;
}

function SnowFlake({ delay, left, duration }) {
  return <div className="snow-flake" style={{ left: `${left}%`, animationDelay: `${delay}s`, animationDuration: `${duration}s` }} />;
}

function SunRay({ angle }) {
  return <div className="sun-ray" style={{ transform: `rotate(${angle}deg)` }} />;
}

function Cloud({ delay, top, speed }) {
  return <div className="floating-cloud" style={{ top: `${top}%`, animationDelay: `${delay}s`, animationDuration: `${speed}s` }} />;
}

export default function WeatherEffects({ iconCode }) {
  const type = getWeatherType(iconCode);

  const particles = useMemo(() => {
    if (type === 'rain' || type === 'storm') {
      return Array.from({ length: type === 'storm' ? 80 : 40 }, (_, i) => ({
        id: i,
        delay: Math.random() * 2,
        left: Math.random() * 100,
        duration: 0.4 + Math.random() * 0.4,
      }));
    }
    if (type === 'snow') {
      return Array.from({ length: 35 }, (_, i) => ({
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
    return Array.from({ length: 5 }, (_, i) => ({
      id: i,
      delay: Math.random() * 10,
      top: 10 + Math.random() * 60,
      speed: 20 + Math.random() * 15,
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

  if (type === 'clouds' || type === 'fog') {
    return (
      <div className="weather-effects clouds-bg">
        {clouds.map(c => <Cloud key={c.id} {...c} />)}
      </div>
    );
  }

  return null;
}
