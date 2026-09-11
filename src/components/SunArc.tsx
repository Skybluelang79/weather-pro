import { useState, useEffect, useMemo } from 'react';

interface SunArcProps {
  sunrise: number;
  sunset: number;
  timezone: number;
}

export default function SunArc({ sunrise, sunset, timezone }: SunArcProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const info = useMemo(() => {
    const nowSec = now / 1000;
    const sunriseTime = sunrise;
    const sunsetTime = sunset;
    const dayLength = sunsetTime - sunriseTime;
    const elapsed = nowSec - sunriseTime;
    const progress = Math.max(0, Math.min(1, elapsed / dayLength));

    const isDay = nowSec >= sunriseTime && nowSec <= sunsetTime;

    const angle = progress * Math.PI;
    const arcX = 50 + 40 * Math.cos(Math.PI - angle);
    const arcY = 90 - 80 * Math.sin(angle);

    const fmtTime = (ts: number) => {
      const d = new Date((ts + timezone) * 1000);
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    return {
      dotX: `${arcX}%`,
      dotY: `${arcY}%`,
      isDay,
      progress,
      sunriseLabel: fmtTime(sunriseTime),
      sunsetLabel: fmtTime(sunsetTime),
    };
  }, [sunrise, sunset, timezone, now]);

  return (
    <div className="sun-arc-container">
      <div className="sun-arc-horizon" />
      <div className="sun-arc-path" />
      <div
        className="sun-arc-dot"
        style={{ left: info.dotX, bottom: info.dotY }}
      />
      <span className="sun-arc-label sunrise">{info.sunriseLabel}</span>
      <span className="sun-arc-label sunset">{info.sunsetLabel}</span>
      <span className="sun-arc-label now">{info.isDay ? 'Daytime' : 'Nighttime'}</span>
    </div>
  );
}