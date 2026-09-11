import type { HistoryEntry } from '../types';

interface SearchChipsProps {
  history: HistoryEntry[];
  onSelect: (city: string) => void;
}

export default function SearchChips({ history, onSelect }: SearchChipsProps) {
  if (!history || history.length === 0) return null;

  const recent = history.slice(0, 5);

  return (
    <div className="search-chips">
      {recent.map(h => (
        <button key={h.id} className="search-chip" onClick={() => onSelect(h.city)}>
          {h.city}
        </button>
      ))}
    </div>
  );
}