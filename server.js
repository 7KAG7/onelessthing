require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY || '';

function suggestOutfit(weather, gender) {
  const temp = weather.main.temp; // Fahrenheit expected
  const cond = weather.weather[0].main.toLowerCase();
  const tiles = {
    head: null,
    torso: null,
    bottoms: null,
    footwear: null,
    accessories: []
  };

  if (temp <= 40) {
    tiles.head = { name: 'Warm hat', reason: 'Cold: under 40°F' };
    tiles.torso = { name: 'Insulated jacket', reason: 'Cold' };
    tiles.bottoms = { name: 'Warm pants', reason: 'Cold' };
    tiles.footwear = { name: 'Boots', reason: 'Cold' };
    tiles.accessories.push({ name: 'Gloves', reason: 'Cold' });
  } else if (temp <= 60) {
    tiles.head = { name: 'Beanie or cap', reason: 'Cool' };
    tiles.torso = { name: 'Light jacket or sweater', reason: 'Cool' };
    tiles.bottoms = { name: 'Jeans', reason: 'Cool' };
    tiles.footwear = { name: 'Sneakers', reason: 'Cool' };
  } else {
    tiles.head = { name: 'Cap or sunhat', reason: 'Warm' };
    tiles.torso = { name: 'T-shirt or top', reason: 'Warm' };
    tiles.bottoms = { name: 'Shorts or light pants', reason: 'Warm' };
    tiles.footwear = { name: 'Sandals or sneakers', reason: 'Warm' };
  }

  if (cond.includes('rain') || cond.includes('drizzle')) {
    tiles.accessories.push({ name: 'Umbrella', reason: 'Rainy' });
  }
  if (cond.includes('snow')) {
    tiles.accessories.push({ name: 'Snow gloves', reason: 'Snow' });
  }

  // Attach sample affiliate search links (MVP: generic searches)
  function toLink(item) {
    const q = encodeURIComponent(item.name + ' ' + (gender || 'unisex'));
    return `https://www.amazon.com/s?k=${q}`;
  }

  Object.keys(tiles).forEach((k) => {
    const v = tiles[k];
    if (!v) return;
    if (Array.isArray(v)) {
      v.forEach((it) => { it.link = toLink(it); });
    } else {
      v.link = toLink(v);
    }
  });

  return tiles;
}

async function fetchWeatherByCity(city) {
  if (!OPENWEATHER_KEY) throw new Error('OPENWEATHER_API_KEY not set');
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=imperial&appid=${OPENWEATHER_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchWeatherByLatLon(lat, lon) {
  if (!OPENWEATHER_KEY) throw new Error('OPENWEATHER_API_KEY not set');
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${OPENWEATHER_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

app.get('/api/weather', async (req, res) => {
  try {
    const { city, lat, lon, gender } = req.query;
    let weather;
    if (city) {
      weather = await fetchWeatherByCity(city);
    } else if (lat && lon) {
      weather = await fetchWeatherByLatLon(lat, lon);
    } else {
      return res.status(400).json({ error: 'Provide city or lat & lon' });
    }

    const tiles = suggestOutfit(weather, gender);
    return res.json({ weather, tiles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend
app.use('/', express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
