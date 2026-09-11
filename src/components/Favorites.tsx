import type { Favorite } from '../types';

interface FavoritesProps {
  favorites: Favorite[];
  onClick: (fav: Favorite) => void;
  onRemove: (id: string) => void;
}

export default function Favorites({ favorites, onClick, onRemove }: FavoritesProps) {
  return (
    <div className="favorites animate-slide-up">
      <h3 className="section-title">Saved Locations</h3>
      <div className="favorites-list">
        {favorites.map((fav, i) => (
          <div key={fav.id} className="fav-card" style={{ animationDelay: `${i * 0.06}s` }} onClick={() => onClick(fav)}>
            <div className="fav-info">
              <span className="fav-city">{fav.city}</span>
              <span className="fav-country">{fav.country}</span>
            </div>
            <button className="fav-remove" onClick={(e) => { e.stopPropagation(); onRemove(fav.id); }} title="Remove">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}