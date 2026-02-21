import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createUser, findUserByUsername, findUserById, updateUser } from './usersStore';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY || '';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

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

  // For MVP: frontend will render generic images/icons for items; no affiliate links attached.

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

// --- Auth & user endpoints (MVP file-backed)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const existing = await findUserByUsername(username);
    if (existing) return res.status(409).json({ error: 'user exists' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ id: uuidv4(), username, passwordHash });
    const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, ageRange: user.ageRange, sexPreference: user.sexPreference, avatar: user.avatar } });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const user = await findUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, ageRange: user.ageRange, sexPreference: user.sexPreference, avatar: user.avatar } });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

function authMiddleware(req: Request, res: Response, next: any) {
  const h = req.headers.authorization as string | undefined;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });
  const token = h.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    (req as any).userId = payload.uid;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const uid = (req as any).userId as string;
    const user = await findUserById(uid);
    if (!user) return res.status(404).json({ error: 'not found' });
    res.json({ id: user.id, username: user.username, ageRange: user.ageRange, sexPreference: user.sexPreference, avatar: user.avatar });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const uid = (req as any).userId as string;
    const { ageRange, sexPreference } = req.body;
    const updated = await updateUser(uid, { ageRange, sexPreference });
    if (!updated) return res.status(404).json({ error: 'not found' });
    res.json({ id: updated.id, username: updated.username, ageRange: updated.ageRange, sexPreference: updated.sexPreference, avatar: updated.avatar });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend
app.use('/', express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
