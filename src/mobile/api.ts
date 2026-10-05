import { LocationsResponse, OutfitResponse } from './contracts';
import { MobileApiError } from './errors';
import { normalizeCurrentWeather, normalizeForecast, normalizeLocations } from './normalize';
import { buildOutfit } from './outfit';
import { parseLocationsQuery, parseOutfitQuery, Query } from './validation';

export { MobileApiError, toErrorResponse } from './errors';
export type { LocationsResponse, OutfitResponse, MobileErrorResponse } from './contracts';

export interface MobileApiOptions {
  apiKey: string;
  affiliateTag?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}

/** Portable service: no Express, credentials at build time, account store, or disk IO. */
export function createMobileApi(options: MobileApiOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const timeoutMs = Math.max(1, Math.min(options.timeoutMs ?? 5000, 15000));

  function requireKey(): void {
    if (!options.apiKey.trim()) {
      throw new MobileApiError(503, 'SERVICE_UNAVAILABLE', 'Live weather is not configured yet. Please try again later.');
    }
  }

  async function getJson(url: URL, notFoundIsLocation = false): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new MobileApiError(504, 'UPSTREAM_TIMEOUT', 'The weather service took too long. Please try again.', true));
      }, timeoutMs);
    });
    const request = (async () => {
      try {
        const response = await fetchImpl(url.toString(), {
          signal: controller.signal,
          headers: { accept: 'application/json' },
          // Only known provider hosts are requested. Do not follow redirects elsewhere.
          redirect: 'error'
        });
        if (!response.ok) {
          if (response.status === 404 && notFoundIsLocation) {
            throw new MobileApiError(404, 'LOCATION_NOT_FOUND', 'We could not find that location. Try a nearby city.');
          }
          throw new MobileApiError(502, 'UPSTREAM_UNAVAILABLE', 'The weather service is temporarily unavailable. Please try again.', true);
        }
        try {
          return await response.json() as unknown;
        } catch {
          throw new MobileApiError(502, 'INVALID_UPSTREAM_RESPONSE', 'Weather data is temporarily unavailable.', true);
        }
      } catch (error) {
        if (error instanceof MobileApiError) throw error;
        throw new MobileApiError(502, 'UPSTREAM_UNAVAILABLE', 'The weather service is temporarily unavailable. Please try again.', true);
      }
    })();
    try {
      // The deadline covers both the network request and reading/parsing its body.
      return await Promise.race([request, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function locations(query: Query): Promise<LocationsResponse> {
    const request = parseLocationsQuery(query);
    requireKey();
    const url = new URL('https://api.openweathermap.org/geo/1.0/direct');
    url.searchParams.set('q', request.q);
    url.searchParams.set('limit', String(request.limit));
    url.searchParams.set('appid', options.apiKey);
    const result = await getJson(url);
    return { apiVersion: '1', locations: normalizeLocations(result, request.limit) };
  }

  async function outfit(query: Query): Promise<OutfitResponse> {
    const request = parseOutfitQuery(query);
    requireKey();
    const url = new URL('https://api.openweathermap.org/data/2.5/weather');
    if ('city' in request) url.searchParams.set('q', request.city);
    else {
      url.searchParams.set('lat', String(request.lat));
      url.searchParams.set('lon', String(request.lon));
    }
    url.searchParams.set('units', 'imperial');
    url.searchParams.set('appid', options.apiKey);
    const raw = await getJson(url, true);
    const generated = now();
    const { location, weather } = normalizeCurrentWeather(raw, generated);
    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
    forecastUrl.searchParams.set('latitude', String(location.lat));
    forecastUrl.searchParams.set('longitude', String(location.lon));
    forecastUrl.searchParams.set('hourly', 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m');
    forecastUrl.searchParams.set('temperature_unit', 'fahrenheit');
    forecastUrl.searchParams.set('wind_speed_unit', 'mph');
    forecastUrl.searchParams.set('forecast_days', '2');
    forecastUrl.searchParams.set('timezone', 'UTC');
    let forecast: OutfitResponse['forecast'] = [];
    const warnings: string[] = [];
    try {
      forecast = normalizeForecast(await getJson(forecastUrl), generated);
      if (!forecast.length) warnings.push('Hourly forecast is temporarily unavailable. Your outfit uses current weather.');
    } catch {
      warnings.push('Hourly forecast is temporarily unavailable. Your outfit uses current weather.');
    }
    return {
      apiVersion: '1',
      generatedAt: generated.toISOString(),
      location,
      weather,
      preferences: { style: request.style, comfort: request.comfort },
      outfit: buildOutfit(weather, request.style, request.comfort, options.affiliateTag),
      forecast,
      warnings
    };
  }

  return { outfit, locations };
}
