import { useMemo } from 'react';
import type { ForecastData } from '../types';
import { formatTemp } from '../services/helpers';

interface TempGraphProps {
  data: ForecastData;
  unit: string;
}

export default function TempGraph({ data, unit }: TempGraphProps) {
  const points = useMemo(() => {
    if (!data || !data.list) return [];
    return data.list.map(item => ({
      time: item.dt,
      temp: item.main.temp,
      icon: item.weather[0].icon,
    }));
  }, [data]);

  if (points.length === 0) return null;

  const temps = points.map(p => p.temp);
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const tempRange = maxTemp - minTemp || 1;

  const svgWidth = 800;
  const svgHeight = 260;
  const padTop = 40;
  const padBottom = 50;
  const padLeft = 20;
  const padRight = 20;
  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const getX = (i: number) => padLeft + (i / (points.length - 1)) * chartW;
  const getY = (temp: number) => padTop + (1 - (temp - minTemp) / tempRange) * chartH;

  const linePath = points.map((p, i) => {
    const x = getX(i);
    const y = getY(p.temp);
    if (i === 0) return `M ${x} ${y}`;
    const prevX = getX(i - 1);
    const prevY = getY(points[i - 1].temp);
    const cpx1 = prevX + (x - prevX) * 0.4;
    const cpx2 = x - (x - prevX) * 0.4;
    return `C ${cpx1} ${prevY} ${cpx2} ${y} ${x} ${y}`;
  }).join(' ');

  const areaPath = linePath +
    ` L ${getX(points.length - 1)} ${padTop + chartH}` +
    ` L ${getX(0)} ${padTop + chartH} Z`;

  const labelIndices = new Set<number>();
  for (let i = 0; i < points.length; i++) {
    if (i === 0 || i === points.length - 1) {
      labelIndices.add(i);
      continue;
    }
    const prev = points[i - 1].temp;
    const curr = points[i].temp;
    const next = points[i + 1].temp;
    if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
      labelIndices.add(i);
    }
  }

  const timeLabels = points.map((p, i) => {
    const d = new Date(p.time * 1000);
    return {
      x: getX(i),
      label: d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
    };
  });

  const maxLabels = 10;
  const step = Math.max(1, Math.floor(timeLabels.length / maxLabels));
  const visibleTimeLabels = timeLabels.filter((_, i) => i % step === 0 || i === timeLabels.length - 1);

  return (
    <div className="temp-graph">
      <h3 className="section-title">Temperature Trend</h3>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="temp-graph-svg">
        <defs>
          <linearGradient id="tempGradFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="tempGradStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#tempGradFill)" />
        <path d={linePath} fill="none" stroke="url(#tempGradStroke)" strokeWidth="2.5" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={getX(i)} cy={getY(p.temp)} r="3" fill="var(--accent)" opacity="0.8" />
        ))}
        {[...labelIndices].map(i => (
          <g key={`label-${i}`}>
            <text x={getX(i)} y={getY(points[i].temp) - 12} textAnchor="middle" className="temp-graph-label">
              {formatTemp(points[i].temp, unit)}
            </text>
          </g>
        ))}
        {visibleTimeLabels.map((tl, i) => (
          <text key={i} x={tl.x} y={svgHeight - 10} textAnchor="middle" className="temp-graph-time">
            {tl.label}
          </text>
        ))}
      </svg>
    </div>
  );
}