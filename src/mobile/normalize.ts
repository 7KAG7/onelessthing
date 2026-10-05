import { ForecastHour, MobileLocation, MobileWeather, WeatherCondition } from './contracts';
import { MobileApiError } from './errors';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as JsonObject : {};
const text = (value: unknown, fallback = ''): string => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 160) || fallback : fallback;
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const between = (value: unknown, min: number, max: number): number | null => {
  const n = number(value);
  return n !== null && n >= min && n <= max ? n : null;
};
const round = (value: number): number => Math.round(value * 10) / 10;
const epochIso = (seconds: unknown): string | null => {
  const value = between(seconds, 0, 8640000000000);
  return value === null ? null : new Date(value * 1000).toISOString();
};

function malformed(): never {
  throw new MobileApiError(502, 'INVALID_UPSTREAM_RESPONSE', 'Weather data is temporarily unavailable.', true);
}

export function normalizeCondition(id: unknown, main: unknown): WeatherCondition {
  const code = number(id);
  if (code !== null) {
    if (code >= 200 && code < 300) return 'storm';
    if (code >= 300 && code < 600) return 'rain';
    if (code >= 600 && code < 700) return 'snow';
    if (code >= 700 && code < 800) return 'fog';
    if (code === 800) return 'clear';
    if (code > 800 && code < 900) return 'cloudy';
  }
  const label = text(main).toLowerCase();
  if (/thunder|storm/.test(label)) return 'storm';
  if (/rain|drizzle/.test(label)) return 'rain';
  if (/snow|sleet/.test(label)) return 'snow';
  if (/fog|mist|haze|smoke|dust|sand|ash/.test(label)) return 'fog';
  if (/clear/.test(label)) return 'clear';
  if (/cloud/.test(label)) return 'cloudy';
  return 'mixed';
}

export function normalizeCurrentWeather(raw: unknown, now: Date): { location: MobileLocation; weather: MobileWeather } {
  const data = object(raw);
  const main = object(data.main);
  const coord = object(data.coord);
  const sys = object(data.sys);
  const condition = object(Array.isArray(data.weather) ? data.weather[0] : null);
  const wind = object(data.wind);
  const lat = between(coord.lat, -90, 90);
  const lon = between(coord.lon, -180, 180);
  const temp = between(main.temp, -200, 200);
  const feelsLike = between(main.feels_like, -200, 200);
  const humidity = between(main.humidity, 0, 100);
  const windSpeed = between(wind.speed, 0, 400);
  const observedAt = epochIso(data.dt);
  // Invalid required data is an upstream failure, never fabricated weather.
  if (lat === null || lon === null || temp === null || feelsLike === null || humidity === null || windSpeed === null || !observedAt) malformed();
  const name = text(data.name, 'Current location');
  const country = text(sys.country);
  const location: MobileLocation = { name, state: null, country, lat, lon, label: [name, country].filter(Boolean).join(', ') };
  const sunrise = number(sys.sunrise);
  const sunset = number(sys.sunset);
  const icon = text(condition.icon);
  const seconds = now.getTime() / 1000;
  const isDay = /^[0-9]{2}[dn]$/.test(icon)
    ? icon.endsWith('d')
    : sunrise !== null && sunset !== null ? seconds >= sunrise && seconds < sunset : true;
  return {
    location,
    weather: {
      temperatureF: round(temp),
      feelsLikeF: round(feelsLike),
      condition: normalizeCondition(condition.id, condition.main),
      description: text(condition.description, text(condition.main, 'Mixed conditions')),
      windMph: round(windSpeed),
      humidityPct: humidity,
      observedAt,
      isDay,
      timezoneOffsetSeconds: between(data.timezone, -86400, 86400) ?? 0
    }
  };
}

export function normalizeLocations(raw: unknown, limit: number): MobileLocation[] {
  if (!Array.isArray(raw)) malformed();
  const seen = new Set<string>();
  const result: MobileLocation[] = [];
  for (const entry of raw) {
    const item = object(entry);
    const name = text(item.name);
    const country = text(item.country);
    const state = text(item.state) || null;
    const lat = between(item.lat, -90, 90);
    const lon = between(item.lon, -180, 180);
    if (!name || !country || lat === null || lon === null) continue;
    const label = [name, state, country].filter(Boolean).join(', ');
    const key = `${label}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name, state, country, lat, lon, label });
    if (result.length >= limit) break;
  }
  return result;
}

export function normalizeForecastCondition(code: number): WeatherCondition {
  if (code === 0) return 'clear';
  if ([1, 2, 3].includes(code)) return 'cloudy';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return 'mixed';
}

export function normalizeForecast(raw: unknown, now: Date): ForecastHour[] {
  const hourly = object(object(raw).hourly);
  if (!Array.isArray(hourly.time)) malformed();
  const times = hourly.time;
  const temps = Array.isArray(hourly.temperature_2m) ? hourly.temperature_2m : [];
  const chances = Array.isArray(hourly.precipitation_probability) ? hourly.precipitation_probability : [];
  const winds = Array.isArray(hourly.wind_speed_10m) ? hourly.wind_speed_10m : [];
  const codes = Array.isArray(hourly.weather_code) ? hourly.weather_code : [];
  const seen = new Set<number>();
  const result: ForecastHour[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const time = typeof times[i] === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(times[i]) ? Date.parse(`${times[i]}Z`) : NaN;
    const temperature = between(temps[i], -200, 200);
    const chance = between(chances[i], 0, 100);
    const wind = between(winds[i], 0, 400);
    const code = number(codes[i]);
    if (!Number.isFinite(time) || seen.has(time) || time < now.getTime() || time > now.getTime() + 24 * 60 * 60 * 1000) continue;
    if (temperature === null || chance === null || wind === null || code === null) continue;
    seen.add(time);
    result.push({ time: new Date(time).toISOString(), temperatureF: round(temperature), precipitationChancePct: chance, condition: normalizeForecastCondition(code), windMph: round(wind) });
  }
  return result.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 24);
}
