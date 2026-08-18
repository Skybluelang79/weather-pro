import { useMemo } from 'react';

export default function SunArc({ sunrise, sunset, timezone }) {
  const info = useMemo(() => {
    const now = Date.now() / 1000;
    const sunriseTime = sunrise;
    const sunsetTime = sunset;
    const dayLength = sunsetTime - sunriseTime;
    const elapsed = now - sunriseTime;
    const progress = Math.max(0, Math.min(1, elapsed / dayLength));

    const isDay = now >= sunriseTime && now <= sunsetTime;

    const angle = progress * Math.PI;
    const arcX = 50 + 40 * Math.cos(Math.PI - angle);
    const arcY = 90 - 80 * Math.sin(angle);

    const fmtTime = (ts) => {
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
  }, [sunrise, sunset, timezone]);

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
