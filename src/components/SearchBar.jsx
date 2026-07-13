import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

export default function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const timer = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowSug(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = (val) => {
    setQuery(val);
    clearTimeout(timer.current);
    if (val.length < 2) { setSuggestions([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const data = await api.geocode(val);
        setSuggestions(data);
        setShowSug(data.length > 0);
      } catch { setSuggestions([]); }
    }, 300);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
      setShowSug(false);
    }
  };

  const selectSuggestion = (s) => {
    setQuery(s.name);
    setShowSug(false);
    onSearch(s.name);
  };

  return (
    <div className="search-container" ref={wrapperRef}>
      <form onSubmit={handleSubmit} className="search-box">
        <div className="search-input-wrap">
          <div className="search-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="18" height="18">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search city..."
            className="search-input"
            disabled={loading}
          />
        </div>
        <button type="submit" className="search-btn" disabled={loading || !query.trim()}>
          {loading ? <span className="spinner" /> : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="20" height="20">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
        </button>
      </form>
      {showSug && suggestions.length > 0 && (
        <div className="search-suggestions">
          {suggestions.map((s, i) => (
            <button key={i} className="suggestion-item" onClick={() => selectSuggestion(s)}>
              <span className="suggestion-city">{s.name}</span>
              <span className="suggestion-country">{s.state ? `${s.state}, ` : ''}{s.country}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
