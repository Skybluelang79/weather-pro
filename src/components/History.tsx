import type { HistoryEntry } from '../types';

interface HistoryProps {
  history: HistoryEntry[];
  onSearch: (city: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export default function History({ history, onSearch, onRemove, onClear }: HistoryProps) {
  return (
    <div className="history animate-slide-up">
      <div className="history-header">
        <h3 className="section-title" style={{ margin: 0 }}>Recent Searches</h3>
        {history.length > 0 && (
          <button className="clear-btn" onClick={onClear}>Clear All</button>
        )}
      </div>
      <div className="history-list">
        {history.map((h, i) => (
          <div key={h.id} className="history-card" style={{ animationDelay: `${i * 0.05}s` }}>
            <button className="history-search" onClick={() => onSearch(h.city)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="history-city">{h.city}</span>
              <span className="history-country">{h.country}</span>
            </button>
            <button className="history-remove" onClick={() => onRemove(h.id)} title="Remove">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}