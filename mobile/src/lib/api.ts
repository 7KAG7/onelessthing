import type { LocationRequest, MobileLocation, OutfitResponse, Preferences } from './types';
import { isLocation, isOutfit } from './validation';
import { sampleLocations, sampleOutfit } from './demo';
import { apiBaseUrl } from '../config';
const rawBase = apiBaseUrl.trim();
export const isSampleMode = !rawBase;
function baseUrl(): string {
  const parsed = new URL(rawBase);
  if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Use an API origin without credentials, query parameters, or a fragment.');
  if (parsed.protocol !== 'https:' && !(__DEV__ && parsed.protocol === 'http:')) throw new Error('The API needs a secure HTTPS address.');
  return rawBase.replace(/\/$/, '');
}
async function request(path: string, signal: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const timer = setTimeout(abort, 15000);
  try {
    const response = await fetch(`${baseUrl()}${path}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    const value: unknown = await response.json();
    if (!response.ok) {
      const error = value && typeof value === 'object' && 'error' in value ? value.error : null;
      const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message.slice(0, 300) : 'Weather is unavailable right now. Please try again.';
      throw new Error(message);
    }
    return value;
  } catch (error) {
    if (controller.signal.aborted && !signal.aborted) throw new Error('That took too long. Please check your connection and try again.');
    throw error;
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}
export async function fetchOutfit(location: LocationRequest, preferences: Preferences, signal: AbortSignal): Promise<OutfitResponse> {
  if (isSampleMode) return sampleOutfit(location, preferences);
  const params = new URLSearchParams({ style: preferences.style, comfort: preferences.comfort });
  if ('city' in location) params.set('city', location.city); else { params.set('lat', String(location.lat)); params.set('lon', String(location.lon)); }
  const value = await request(`/api/v1/outfit?${params}`, signal);
  if (!isOutfit(value)) throw new Error('This API response is not compatible with the app. Please try again later.');
  return value;
}
export async function searchLocations(query: string, signal: AbortSignal): Promise<MobileLocation[]> {
  if (isSampleMode) return sampleLocations.filter(l => l.label.toLowerCase().includes(query.toLowerCase()));
  const value = await request(`/api/v1/locations?${new URLSearchParams({ q: query, limit: '5' })}`, signal);
  if (!value || typeof value !== 'object' || !('locations' in value) || !Array.isArray(value.locations) || !value.locations.every(isLocation)) throw new Error('Location search is unavailable. Try the city name directly.');
  return value.locations;
}
