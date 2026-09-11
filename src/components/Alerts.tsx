import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { AlertData } from '../types';

interface AlertsProps {
  lat: number;
  lon: number;
}

export default function Alerts({ lat, lon }: AlertsProps) {
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lat || !lon) return;
    let cancelled = false;
    setLoading(true);
    api.getAlerts(lat, lon).then(data => {
      if (!cancelled) {
        setAlerts(data.alerts || []);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [lat, lon]);

  if (loading) return null;
  if (!alerts.length) return null;

  return (
    <div className="alerts animate-slide-up">
      <div className="alerts-header">
        <span className="alerts-icon">🔔</span>
        <h3 className="section-title" style={{ margin: 0 }}>Weather Alerts ({alerts.length})</h3>
      </div>
      <div className="alerts-list">
        {alerts.map((alert, i) => (
          <div
            key={alert.id || i}
            className={`alert-card ${alert.severity?.toLowerCase() || 'unknown'} ${expanded === i ? 'expanded' : ''}`}
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div className="alert-top">
              <span className={`alert-severity ${alert.severity?.toLowerCase() || 'unknown'}`}>
                {alert.severity || 'Unknown'}
              </span>
              <span className="alert-urgency">{alert.urgency}</span>
            </div>
            <div className="alert-event">{alert.event}</div>
            {expanded === i && (
              <div className="alert-details">
                <p className="alert-desc">{alert.description || alert.headline}</p>
                {alert.instruction && (
                  <div className="alert-instruction">
                    <strong>Instruction:</strong> {alert.instruction}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}