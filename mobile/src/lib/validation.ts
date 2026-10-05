import type { MobileLocation, OutfitResponse, Preferences, SavedOutfit } from './types';
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length <= 2000;
const date = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));
const condition = (value: unknown) => ['clear', 'cloudy', 'rain', 'snow', 'storm', 'fog', 'mixed'].includes(String(value));
export function safeShopUrl(value: unknown): value is string {
  if (!text(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.amazon.com' && url.pathname === '/s' && !url.username && !url.password && !url.port;
  } catch { return false; }
}
export function isLocation(value: unknown): value is MobileLocation {
  return record(value) && text(value.name) && text(value.country) && text(value.label)
    && (value.state === null || text(value.state)) && finite(value.lat) && Math.abs(value.lat) <= 90
    && finite(value.lon) && Math.abs(value.lon) <= 180;
}
export function isOutfit(value: unknown): value is OutfitResponse {
  if (!record(value) || value.apiVersion !== '1' || !date(value.generatedAt) || !isLocation(value.location)) return false;
  const w = value.weather, o = value.outfit, p = value.preferences;
  if (!record(w) || !finite(w.temperatureF) || !finite(w.feelsLikeF) || !finite(w.windMph)
    || !finite(w.humidityPct) || w.humidityPct < 0 || w.humidityPct > 100 || !condition(w.condition)
    || !text(w.description) || !date(w.observedAt) || typeof w.isDay !== 'boolean' || !finite(w.timezoneOffsetSeconds)) return false;
  if (!record(p) || !['unisex','male','female'].includes(String(p.style)) || !['cooler','neutral','warmer'].includes(String(p.comfort))) return false;
  if (!record(o) || !text(o.title) || !text(o.summary) || !finite(o.effectiveTemperatureF)
    || !Array.isArray(o.pieces) || o.pieces.length < 1 || o.pieces.length > 20 || !Array.isArray(o.tips) || !o.tips.every(text)) return false;
  if (!o.pieces.every(v => record(v) && text(v.id) && text(v.name) && text(v.reason)
    && ['head','top','bottoms','footwear','accessory'].includes(String(v.category)) && safeShopUrl(v.searchUrl))) return false;
  return Array.isArray(value.warnings) && value.warnings.every(text)
    && Array.isArray(value.forecast) && value.forecast.length <= 48 && value.forecast.every(h => record(h)
    && date(h.time) && finite(h.temperatureF) && finite(h.precipitationChancePct) && h.precipitationChancePct >= 0
    && h.precipitationChancePct <= 100 && finite(h.windMph) && condition(h.condition));
}
export const defaultPreferences: Preferences = { style: 'unisex', comfort: 'neutral', unit: 'F', city: '' };
export function restorePreferences(value: unknown): Preferences {
  if (!record(value)) return { ...defaultPreferences };
  return {
    style: value.style === 'male' || value.style === 'female' ? value.style : 'unisex',
    comfort: value.comfort === 'cooler' || value.comfort === 'warmer' ? value.comfort : 'neutral',
    unit: value.unit === 'C' ? 'C' : 'F',
    city: typeof value.city === 'string' ? value.city.trim().slice(0, 120) : '',
    ...(record(value.location) && finite(value.location.lat) && Math.abs(value.location.lat) <= 90 && finite(value.location.lon) && Math.abs(value.location.lon) <= 180
      ? { location: { lat: Number(value.location.lat.toFixed(2)), lon: Number(value.location.lon.toFixed(2)) } } : {}),
  };
}
export function restoreSaved(value: unknown): SavedOutfit[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is SavedOutfit => record(v) && text(v.id) && date(v.savedAt)
    && typeof v.sample === 'boolean' && isOutfit(v.data)).slice(0, 30);
}
export function outfitKey(data: OutfitResponse, sample: boolean): string {
  return [sample ? 'sample' : 'live', data.location.lat.toFixed(2), data.location.lon.toFixed(2),
    data.weather.observedAt.slice(0, 10), data.preferences.style, data.preferences.comfort,
    data.outfit.pieces.map(p => p.name).join('|')].join(':');
}
