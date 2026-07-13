import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import fetch from 'node-fetch';

config();

const app = express();
const PORT = process.env.PORT || 3002;
const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE = 'https://api.openweathermap.org/data/2.5';
const GEO_BASE = 'https://api.openweathermap.org/geo/1.0';

app.use(cors());
app.use(express.json());

const favorites = [];
const searchHistory = [];

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

app.get('/api/weather/current', async (req, res) => {
  try {
    const { city, lat, lon, units = 'metric' } = req.query;
    let url;
    if (lat && lon) {
      url = `${BASE}/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`;
    } else if (city) {
      url = `${BASE}/weather?q=${encodeURIComponent(city)}&units=${units}&appid=${API_KEY}`;
    } else {
      return res.status(400).json({ error: 'Provide city or lat/lon' });
    }
    const r = await fetch(url);
    const data = await r.json();
    if (data.cod && data.cod !== 200) {
      return res.status(data.cod).json({ error: data.message });
    }
    if (city && !searchHistory.find(h => h.city.toLowerCase() === data.name.toLowerCase())) {
      searchHistory.unshift({ id: genId(), city: data.name, country: data.sys.country, timestamp: Date.now() });
      if (searchHistory.length > 20) searchHistory.pop();
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
});

app.get('/api/weather/forecast', async (req, res) => {
  try {
    const { city, lat, lon, units = 'metric' } = req.query;
    let url;
    if (lat && lon) {
      url = `${BASE}/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`;
    } else if (city) {
      url = `${BASE}/forecast?q=${encodeURIComponent(city)}&units=${units}&appid=${API_KEY}`;
    } else {
      return res.status(400).json({ error: 'Provide city or lat/lon' });
    }
    const r = await fetch(url);
    const data = await r.json();
    if (data.cod && data.cod !== '200') {
      return res.status(400).json({ error: data.message });
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch forecast' });
  }
});

app.get('/api/weather/air', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
    const url = `http://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch air quality' });
  }
});

app.get('/api/geocode', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;
    if (!q) return res.status(400).json({ error: 'q required' });
    const url = `${GEO_BASE}/direct?q=${encodeURIComponent(q)}&limit=${limit}&appid=${API_KEY}`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to geocode' });
  }
});

app.get('/api/favorites', (req, res) => {
  res.json(favorites);
});

app.post('/api/favorites', (req, res) => {
  const { city, country, lat, lon } = req.body;
  if (!city) return res.status(400).json({ error: 'city required' });
  if (favorites.find(f => f.city.toLowerCase() === city.toLowerCase())) {
    return res.status(409).json({ error: 'Already in favorites' });
  }
  const fav = { id: genId(), city, country, lat, lon, addedAt: Date.now() };
  favorites.unshift(fav);
  res.json(fav);
});

app.delete('/api/favorites/:id', (req, res) => {
  const idx = favorites.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  favorites.splice(idx, 1);
  res.json({ success: true });
});

app.get('/api/history', (req, res) => {
  res.json(searchHistory);
});

app.delete('/api/history/:id', (req, res) => {
  const idx = searchHistory.findIndex(h => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  searchHistory.splice(idx, 1);
  res.json({ success: true });
});

app.delete('/api/history', (req, res) => {
  searchHistory.length = 0;
  res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Weather API running on http://localhost:${PORT}`);
});
