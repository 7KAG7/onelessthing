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
type CachedPreviewImage = {
  buffer: Buffer;
  contentType: string;
  expiresAt: number;
  lastAccess: number;
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

function addAffiliateLink(item: any, gender?: string) {
  const audience = (() => {
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
  })();

  return {
    ...item,
    link: buildAmazonSearchLink(`${audience} ${item.name} clothing`)
  };
}

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

  tiles.head = addAffiliateLink(tiles.head, gender);
  tiles.torso = addAffiliateLink(tiles.torso, gender);
  tiles.bottoms = addAffiliateLink(tiles.bottoms, gender);
  tiles.footwear = addAffiliateLink(tiles.footwear, gender);
  tiles.accessories = tiles.accessories.map((item: any) => addAffiliateLink(item, gender));

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
    const userId = getOptionalUserId(req);
    let weather: WeatherJSON;
    if (city) {
      weather = await fetchWeatherByCity(city);
    } else if (lat && lon) {
      weather = await fetchWeatherByLatLon(lat, lon);
    } else {
      return res.status(400).json({ error: 'Provide city or lat & lon' });
    }

    const effectiveGender = userId ? gender : 'unisex';
    const tiles = suggestOutfit(weather, effectiveGender);
    return res.json({ weather, tiles });
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
    res.json({ token, user: { id: user.id, username: user.username, ageRange: user.ageRange, sexPreference: user.sexPreference, avatar: user.avatar, defaultLocation: (user as any).defaultLocation } });
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
    res.json({ token, user: { id: user.id, username: user.username, ageRange: user.ageRange, sexPreference: user.sexPreference, avatar: user.avatar, defaultLocation: (user as any).defaultLocation } });
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
    res.json({ id: user.id, username: user.username, ageRange: user.ageRange, sexPreference: user.sexPreference, avatar: user.avatar, defaultLocation: (user as any).defaultLocation });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const uid = (req as any).userId as string;
    const { ageRange, sexPreference, avatar, defaultLocation } = req.body;
    const updated = await updateUser(uid, { ageRange, sexPreference, avatar, defaultLocation } as any);
    if (!updated) return res.status(404).json({ error: 'not found' });
    res.json({ id: updated.id, username: updated.username, ageRange: updated.ageRange, sexPreference: updated.sexPreference, avatar: updated.avatar, defaultLocation: (updated as any).defaultLocation });
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
