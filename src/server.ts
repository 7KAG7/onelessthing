import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY || '';

type WeatherJSON = any;

function suggestOutfit(weather: WeatherJSON, gender?: string) {
  const temp = weather.main.temp as number; // Fahrenheit
  const cond = (weather.weather[0].main as string).toLowerCase();
  const tiles: any = {
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

  function toLink(item: any) {
    const q = encodeURIComponent(item.name + ' ' + (gender || 'unisex'));
    return `https://www.amazon.com/s?k=${q}`;
  }

  Object.keys(tiles).forEach((k) => {
    const v = tiles[k];
    if (!v) return;
    if (Array.isArray(v)) {
      v.forEach((it: any) => { it.link = toLink(it); });
    } else {
      v.link = toLink(v);
    }
  });

  return tiles;
}

async function fetchWeatherByCity(city: string): Promise<WeatherJSON> {
  if (!OPENWEATHER_KEY) throw new Error('OPENWEATHER_API_KEY not set');
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=imperial&appid=${OPENWEATHER_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`${res.status} ${body.message || res.statusText}`);
  }
  return res.json();
}

async function fetchWeatherByLatLon(lat: string, lon: string): Promise<WeatherJSON> {
  if (!OPENWEATHER_KEY) throw new Error('OPENWEATHER_API_KEY not set');
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${OPENWEATHER_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`${res.status} ${body.message || res.statusText}`);
  }
  return res.json();
}

app.get('/api/weather', async (req: Request, res: Response) => {
  try {
    console.log('/api/weather', req.query);
    const { city, lat, lon, gender } = req.query as Record<string, string>;
    let weather: WeatherJSON;
    if (city) {
      weather = await fetchWeatherByCity(city);
    } else if (lat && lon) {
      weather = await fetchWeatherByLatLon(lat, lon);
    } else {
      return res.status(400).json({ error: 'Provide city or lat & lon' });
    }

    const tiles = suggestOutfit(weather, gender);
    return res.json({ weather, tiles });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend
app.use('/', express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
