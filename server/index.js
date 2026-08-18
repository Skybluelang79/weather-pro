import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import fetch from 'node-fetch';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load data file:', e.message);
  }
  return { favorites: [], searchHistory: [] };
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ favorites, searchHistory }, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save data file:', e.message);
  }
}

const data = loadData();
const favorites = data.favorites;
const searchHistory = data.searchHistory;

const app = express();
const PORT = process.env.PORT || 3002;
const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE = 'https://api.openweathermap.org/data/2.5';
const GEO_BASE = 'https://api.openweathermap.org/geo/1.0';

app.use(cors());
app.use(express.json());

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

app.get('/api/weather/alerts', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
    // Use National Weather Service API for US alerts (free, no key required)
    const url = `https://api.weather.gov/alerts/point?lat=${lat}&lon=${lon}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'WeatherPro/1.0', 'Accept': 'application/json' },
    });
    if (!r.ok) return res.json({ alerts: [] });
    const data = await r.json();
    const alerts = (data.features || []).slice(0, 5).map(f => ({
      id: f.properties.id,
      event: f.properties.event,
      headline: f.properties.headline,
      severity: f.properties.severity,
      urgency: f.properties.urgency,
      description: f.properties.description,
      instruction: f.properties.instruction || '',
    }));
    res.json({ alerts });
  } catch (err) {
    res.json({ alerts: [] });
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
  saveData();
  res.json(fav);
});

app.delete('/api/favorites/:id', (req, res) => {
  const idx = favorites.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  favorites.splice(idx, 1);
  saveData();
  res.json({ success: true });
});

app.get('/api/history', (req, res) => {
  res.json(searchHistory);
});

app.delete('/api/history/:id', (req, res) => {
  const idx = searchHistory.findIndex(h => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  searchHistory.splice(idx, 1);
  saveData();
  res.json({ success: true });
});

app.delete('/api/history', (req, res) => {
  searchHistory.length = 0;
  saveData();
  res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Weather API running on http://localhost:${PORT}`);
});
