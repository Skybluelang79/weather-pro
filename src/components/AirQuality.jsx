import { getAQILevel } from '../services/helpers';

export default function AirQuality({ data }) {
  if (!data || !data.list || !data.list[0]) return null;

  const aqi = data.list[0].main.aqi;
  const level = getAQILevel(aqi);
  const components = data.list[0].components;

  const pollutants = [
    { key: 'pm2_5', label: 'PM2.5', unit: 'μg/m³' },
    { key: 'pm10', label: 'PM10', unit: 'μg/m³' },
    { key: 'o3', label: 'O₃', unit: 'μg/m³' },
    { key: 'no2', label: 'NO₂', unit: 'μg/m³' },
    { key: 'so2', label: 'SO₂', unit: 'μg/m³' },
    { key: 'co', label: 'CO', unit: 'μg/m³' },
  ];

  return (
    <div className="air-quality animate-slide-up">
      <h3 className="section-title">Air Quality</h3>
      <div className="aqi-header" style={{ borderLeftColor: level.color }}>
        <div className="aqi-badge" style={{ background: level.color }}>AQI {aqi}</div>
        <div className="aqi-info">
          <span className="aqi-label" style={{ color: level.color }}>{level.label}</span>
          <span className="aqi-desc">{level.desc}</span>
        </div>
      </div>
      <div className="pollutants-grid">
        {pollutants.map(p => (
          <div key={p.key} className="pollutant-card">
            <span className="pollutant-value">{components[p.key]}</span>
            <span className="pollutant-label">{p.label}</span>
            <span className="pollutant-unit">{p.unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
