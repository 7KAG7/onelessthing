import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import fs from 'fs';
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

const clientDistDir = path.join(__dirname, '..', 'client', 'dist');
const legacyPublicDir = path.join(__dirname, '..', 'public');

const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY || '';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const AMAZON_ASSOCIATE_TAG = process.env.AMAZON_ASSOCIATE_TAG || '';
const PREVIEW_CACHE_TTL_MS = 2 * 60 * 1000;
const PREVIEW_CACHE_MAX_ITEMS = 200;

type WeatherJSON = any;
type HourlyForecast = {
  dt: number;
  temp: number;
  precipitationProbability: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
  description: string;
};
type RadarPreview = {
  frameTime: number;
  host: string;
  path: string;
  lat: number;
  lon: number;
  zoom: number;
};
type CachedPreviewImage = {
  buffer: Buffer;
  contentType: string;
  expiresAt: number;
  lastAccess: number;
};
type LocationSuggestion = {
  name: string;
  state?: string;
  country: string;
  lat: number;
  lon: number;
  label: string;
};

const previewImageCache = new Map<string, CachedPreviewImage>();

function isAmazonHost(hostname: string) {
  const h = hostname.toLowerCase();
  return h === 'amzn.to' || h.endsWith('.amzn.to') || /(^|\.)amazon\.[a-z.]+$/.test(h);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractMetaImageUrl(html: string) {
  const candidates = ['og:image', 'twitter:image', 'twitter:image:src'];
  for (const key of candidates) {
    const p1 = new RegExp(`<meta[^>]+(?:property|name)=["']${escapeRegExp(key)}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
    const p2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeRegExp(key)}["'][^>]*>`, 'i');
    const m = html.match(p1) || html.match(p2);
    if (m?.[1]) return m[1];
  }
  return '';
}

function extractAmazonProductImageUrls(html: string) {
  const urls: string[] = [];

  const imageTagPatterns = [
    /<img[^>]+class=["'][^"']*\bs-image\b[^"']*["'][^>]+src=["']([^"']+)["'][^>]*>/gi,
    /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*\bs-image\b[^"']*["'][^>]*>/gi
  ];
  for (const pattern of imageTagPatterns) {
    for (const match of html.matchAll(pattern)) {
      const src = match[1];
      if (src?.startsWith('http://') || src?.startsWith('https://')) urls.push(src);
    }
  }

  const jsonPatterns = [/"mainUrl":"(https?:\\\/\\\/[^"]+)"/g, /"hiRes":"(https?:\\\/\\\/[^"]+)"/g];
  for (const pattern of jsonPatterns) {
    for (const match of html.matchAll(pattern)) {
      const raw = match[1];
      const decoded = raw.replace(/\\\//g, '/').replace(/\\u0026/g, '&');
      if (decoded.startsWith('http://') || decoded.startsWith('https://')) urls.push(decoded);
    }
  }

  return Array.from(new Set(urls));
}

function getCachedPreviewImage(cacheKey: string) {
  const cached = previewImageCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt) {
    previewImageCache.delete(cacheKey);
    return null;
  }
  cached.lastAccess = Date.now();
  return cached;
}

function trimPreviewCache() {
  if (previewImageCache.size <= PREVIEW_CACHE_MAX_ITEMS) return;
  const entries = Array.from(previewImageCache.entries()).sort((a, b) => a[1].lastAccess - b[1].lastAccess);
  const removeCount = previewImageCache.size - PREVIEW_CACHE_MAX_ITEMS;
  for (let i = 0; i < removeCount; i += 1) {
    previewImageCache.delete(entries[i][0]);
  }
}

function setCachedPreviewImage(cacheKey: string, buffer: Buffer, contentType: string) {
  previewImageCache.set(cacheKey, {
    buffer,
    contentType,
    expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS,
    lastAccess: Date.now()
  });
  trimPreviewCache();
}

async function fetchPreviewImage(affiliateUrl: string, idx: number) {
  const pageRes = await fetch(affiliateUrl, {
    headers: {
      'accept': 'text/html,application/xhtml+xml',
      'user-agent': 'Mozilla/5.0 (compatible; OneLessThingBot/1.0)'
    }
  });
  if (!pageRes.ok) throw new Error(`Preview page fetch failed: ${pageRes.status}`);

  const html = await pageRes.text();
  const pageHost = new URL(pageRes.url).hostname;
  const productImages = isAmazonHost(pageHost) ? extractAmazonProductImageUrls(html) : [];
  const selectedProductImage = productImages.length ? productImages[idx % productImages.length] : '';
  const metaImage = selectedProductImage ? '' : extractMetaImageUrl(html);
  const selectedImage = selectedProductImage || metaImage;
  if (!selectedImage) throw new Error('No preview image found');

  const imageUrl = new URL(selectedImage, pageRes.url).toString();
  const imageRes = await fetch(imageUrl, {
    headers: {
      'accept': 'image/*',
      'user-agent': 'Mozilla/5.0 (compatible; OneLessThingBot/1.0)'
    }
  });
  if (!imageRes.ok) throw new Error(`Preview image fetch failed: ${imageRes.status}`);

  const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
  if (!contentType.toLowerCase().startsWith('image/')) throw new Error('Preview content is not an image');

  const arr = await imageRes.arrayBuffer();
  return { buffer: Buffer.from(arr), contentType };
}

function buildAmazonSearchLink(query: string) {
  const url = new URL('https://www.amazon.com/s');
  url.searchParams.set('k', query);
  if (AMAZON_ASSOCIATE_TAG) {
    url.searchParams.set('tag', AMAZON_ASSOCIATE_TAG);
  }
  return url.toString();
}

function getAgeGroup(age?: string | number, ageRange?: string) {
  const parsedAge = Number(age);
  if (Number.isFinite(parsedAge) && parsedAge > 0) {
    if (parsedAge <= 12) return 'child';
    if (parsedAge <= 17) return 'teen';
    if (parsedAge >= 65) return 'senior';
    return 'adult';
  }

  switch ((ageRange || '').toLowerCase()) {
    case '<18':
      return 'teen';
    case '>=65':
      return 'senior';
    default:
      return 'adult';
  }
}

function getGenderAudience(gender?: string) {
  switch ((gender || '').toLowerCase()) {
    case 'male':
      return 'men';
    case 'female':
      return 'women';
    case 'nb':
      return 'non binary';
    default:
      return 'unisex';
  }
}

function getSearchAudience(gender?: string, age?: string | number, ageRange?: string) {
  const ageGroup = getAgeGroup(age, ageRange);
  if (ageGroup === 'child') {
    switch ((gender || '').toLowerCase()) {
      case 'male':
        return 'boys';
      case 'female':
        return 'girls';
      default:
        return 'kids';
    }
  }
  if (ageGroup === 'teen') return `teen ${getGenderAudience(gender)}`;
  if (ageGroup === 'senior') return `senior ${getGenderAudience(gender)}`;
  return getGenderAudience(gender);
}

function getAgeSearchPhrase(age?: string | number) {
  const parsedAge = Number(age);
  if (!Number.isFinite(parsedAge) || parsedAge <= 0) return '';

  const roundedAge = Math.round(parsedAge);
  const minAge = Math.max(1, roundedAge - 5);
  const maxAge = Math.min(120, roundedAge + 5);
  return `age ${minAge} to ${maxAge}`;
}

function adjustItemForAge(item: any, age?: string | number, ageRange?: string) {
  const ageGroup = getAgeGroup(age, ageRange);
  if (ageGroup === 'adult') return item;

  const agePrefix = (() => {
    if (ageGroup === 'child') return 'Kids';
    if (ageGroup === 'teen') return 'Teen';
    return 'Comfortable';
  })();

  const seniorNames: Record<string, string> = {
    'Warm pants': 'Comfort-fit warm pants',
    Jeans: 'Comfort-fit jeans',
    'Shorts or light pants': 'Breathable light pants',
    Boots: 'Supportive weatherproof boots',
    Sneakers: 'Supportive walking sneakers',
    'Sandals or sneakers': 'Supportive sandals or sneakers',
    'Cap or sunhat': 'Wide-brim sun hat',
    'Light scarf': 'Soft light scarf',
    Sunglasses: 'Polarized sunglasses'
  };

  if (ageGroup === 'senior') {
    return {
      ...item,
      name: seniorNames[item.name] || item.name,
      reason: `${item.reason || 'Weather appropriate'}; comfort-focused`
    };
  }

  return {
    ...item,
    name: item.name.toLowerCase().startsWith(agePrefix.toLowerCase()) ? item.name : `${agePrefix} ${item.name}`,
    reason: `${item.reason || 'Weather appropriate'}; ${ageGroup === 'child' ? 'kid' : 'teen'} appropriate`
  };
}

function addAffiliateLink(item: any, gender?: string, age?: string | number, ageRange?: string) {
  const adjustedItem = adjustItemForAge(item, age, ageRange);
  const audience = getSearchAudience(gender, age, ageRange);
  const ageSearchPhrase = getAgeSearchPhrase(age);
  const searchQuery = [audience, ageSearchPhrase, adjustedItem.name, 'clothing'].filter(Boolean).join(' ');

  return {
    ...adjustedItem,
    link: buildAmazonSearchLink(searchQuery)
  };
}

function describeWeatherCode(code: number) {
  if (code === 0) return 'Clear';
  if ([1, 2].includes(code)) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Storm';
  return 'Mixed';
}

function suggestOutfit(weather: WeatherJSON, gender?: string, age?: string | number, ageRange?: string) {
  const temp = weather.main.temp as number; // Fahrenheit
  const cond = (weather.weather[0].main as string).toLowerCase();
  const windSpeed = Number(weather.wind?.speed || 0);
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

  if (cond.includes('snow')) {
    tiles.accessories.push({ name: 'Snow gloves', reason: 'Snow' });
  } else if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('thunderstorm')) {
    tiles.accessories.push({ name: 'Umbrella', reason: 'Rainy' });
  } else if (temp <= 40) {
    tiles.accessories.push({ name: 'Gloves', reason: 'Cold' });
  } else if (windSpeed >= 15) {
    tiles.accessories.push({ name: 'Light scarf', reason: 'Windy' });
  } else if (temp >= 70 || cond.includes('clear')) {
    tiles.accessories.push({ name: 'Sunglasses', reason: 'Bright or warm' });
  } else {
    tiles.accessories.push({ name: 'Light scarf', reason: 'Mild weather' });
  }

  tiles.head = addAffiliateLink(tiles.head, gender, age, ageRange);
  tiles.torso = addAffiliateLink(tiles.torso, gender, age, ageRange);
  tiles.bottoms = addAffiliateLink(tiles.bottoms, gender, age, ageRange);
  tiles.footwear = addAffiliateLink(tiles.footwear, gender, age, ageRange);
  tiles.accessories = tiles.accessories.map((item: any) => addAffiliateLink(item, gender, age, ageRange));

  return tiles;
}

function getOptionalUserId(req: Request) {
  const h = req.headers.authorization as string | undefined;
  if (!h || !h.startsWith('Bearer ')) return null;
  const token = h.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return payload?.uid || null;
  } catch {
    return null;
  }
}

function publicUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    age: user.age,
    ageRange: user.ageRange,
    sexPreference: user.sexPreference,
    avatar: user.avatar,
    defaultLocation: user.defaultLocation
  };
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

function formatLocationLabel(location: LocationSuggestion) {
  return [location.name, location.state, location.country].filter(Boolean).join(', ');
}

async function fetchLocationSuggestions(query: string, limit: number): Promise<LocationSuggestion[]> {
  if (!OPENWEATHER_KEY) throw new Error('OPENWEATHER_API_KEY not set');
  const url = new URL('https://api.openweathermap.org/geo/1.0/direct');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('appid', OPENWEATHER_KEY);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`${res.status} ${body.message || res.statusText}`);
  }

  const seen = new Set<string>();
  const locations = (await res.json()) as Array<Partial<LocationSuggestion>>;
  return locations
    .filter((location) => location.name && location.country && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lon)))
    .map((location) => ({
      name: String(location.name),
      state: location.state ? String(location.state) : undefined,
      country: String(location.country),
      lat: Number(location.lat),
      lon: Number(location.lon),
      label: ''
    }))
    .map((location) => ({ ...location, label: formatLocationLabel(location) }))
    .filter((location) => {
      const key = `${location.label}|${location.lat.toFixed(3)}|${location.lon.toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function fetchHourlyForecastByLatLon(lat: string | number, lon: string | number): Promise<HourlyForecast[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('precipitation_unit', 'inch');
  url.searchParams.set('forecast_days', '2');
  url.searchParams.set('timezone', 'UTC');

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`${res.status} ${body.reason || body.message || res.statusText}`);
  }

  const data = await res.json();
  const hourly = data.hourly || {};
  const times: string[] = hourly.time || [];
  const now = Date.now();
  const next24Hours = now + 24 * 60 * 60 * 1000;

  return times
    .map((time, index) => {
      const timestamp = new Date(`${time}Z`).getTime();
      const weatherCode = Number(hourly.weather_code?.[index] ?? -1);
      return {
        dt: Math.floor(timestamp / 1000),
        temp: Number(hourly.temperature_2m?.[index] ?? 0),
        precipitationProbability: Number(hourly.precipitation_probability?.[index] ?? 0),
        precipitation: Number(hourly.precipitation?.[index] ?? 0),
        windSpeed: Number(hourly.wind_speed_10m?.[index] ?? 0),
        weatherCode,
        description: describeWeatherCode(weatherCode)
      };
    })
    .filter((hour) => {
      const timestamp = hour.dt * 1000;
      return timestamp >= now && timestamp <= next24Hours;
    })
    .slice(0, 24);
}

async function fetchRadarPreviewByLatLon(lat: string | number, lon: string | number): Promise<RadarPreview | null> {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`${res.status} ${body.message || res.statusText}`);
  }

  const data = await res.json();
  const frames = data?.radar?.past || [];
  const latestFrame = frames[frames.length - 1];
  if (!data?.host || !latestFrame?.path || !latestFrame?.time) return null;

  return {
    frameTime: Number(latestFrame.time),
    host: data.host,
    path: latestFrame.path,
    lat: Number(lat),
    lon: Number(lon),
    zoom: 7
  };
}

app.get('/api/locations', async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string | undefined) || '').trim();
    const requestedLimit = Number(req.query.limit || 6);
    const limit = Math.min(10, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 6));

    if (!q) return res.json({ locations: [] });

    const locations = await fetchLocationSuggestions(q, limit);
    return res.json({ locations });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/weather', async (req: Request, res: Response) => {
  try {
    console.log('/api/weather', req.query);
    const { city, lat, lon, gender, age, ageRange } = req.query as Record<string, string>;
    const userId = getOptionalUserId(req);
    const user = userId ? await findUserById(userId) : null;
    const profileAge = user?.age ?? age;
    const profileAgeRange = user?.ageRange ?? ageRange;
    let weather: WeatherJSON;
    if (city) {
      weather = await fetchWeatherByCity(city);
    } else if (lat && lon) {
      weather = await fetchWeatherByLatLon(lat, lon);
    } else {
      return res.status(400).json({ error: 'Provide city or lat & lon' });
    }

    const tiles = suggestOutfit(weather, gender, profileAge, profileAgeRange);
    const forecast = weather.coord
      ? await fetchHourlyForecastByLatLon(weather.coord.lat, weather.coord.lon).catch((err) => {
          console.warn('hourly forecast unavailable:', err?.message || err);
          return [];
        })
      : [];
    const radar = weather.coord
      ? await fetchRadarPreviewByLatLon(weather.coord.lat, weather.coord.lon).catch((err) => {
          console.warn('radar preview unavailable:', err?.message || err);
          return null;
        })
      : null;
    return res.json({ weather, forecast, radar, tiles });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/preview-image', async (req: Request, res: Response) => {
  try {
    const raw = (req.query.url as string | undefined) || '';
    if (!raw) return res.status(400).json({ error: 'url is required' });
    const idxRaw = req.query.idx as string | undefined;
    const parsedIdx = Number.isFinite(Number(idxRaw)) ? Number(idxRaw) : 0;
    const idx = parsedIdx >= 0 ? Math.floor(parsedIdx) : 0;

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return res.status(400).json({ error: 'invalid url' });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'invalid protocol' });
    }
    if (!isAmazonHost(parsed.hostname)) {
      return res.status(400).json({ error: 'only amazon affiliate links are allowed' });
    }

    const cacheKey = `${parsed.toString()}|idx:${idx}`;
    const cached = getCachedPreviewImage(cacheKey);
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('Content-Type', cached.contentType);
      return res.send(cached.buffer);
    }

    const { buffer, contentType } = await fetchPreviewImage(parsed.toString(), idx);
    setCachedPreviewImage(cacheKey, buffer, contentType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', contentType);
    return res.send(buffer);
  } catch (err: any) {
    console.warn('preview-image error:', err?.message || err);
    return res.status(404).json({ error: 'preview image unavailable' });
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
    res.json({ token, user: publicUser(user) });
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
    res.json({ token, user: publicUser(user) });
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
    res.json(publicUser(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const uid = (req as any).userId as string;
    const { age, sexPreference, defaultLocation } = req.body;
    const parsedAge = age === '' || age === undefined || age === null ? undefined : Number(age);
    if (parsedAge !== undefined && (!Number.isFinite(parsedAge) || parsedAge < 1 || parsedAge > 120)) {
      return res.status(400).json({ error: 'age must be between 1 and 120' });
    }
    const updated = await updateUser(uid, { age: parsedAge, sexPreference, defaultLocation } as any);
    if (!updated) return res.status(404).json({ error: 'not found' });
    res.json(publicUser(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve the Vite production build when available, otherwise fall back to the legacy public app.
const staticDir = fs.existsSync(clientDistDir) ? clientDistDir : legacyPublicDir;
app.use(express.static(staticDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(staticDir, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
