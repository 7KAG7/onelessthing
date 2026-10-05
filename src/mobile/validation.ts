import { OutfitStyle, TemperatureComfort } from './contracts';
import { MobileApiError } from './errors';

export type Query = Record<string, unknown>;
export type OutfitRequest = ({ city: string } | { lat: number; lon: number }) & {
  style: OutfitStyle;
  comfort: TemperatureComfort;
};

function invalid(message: string): never {
  throw new MobileApiError(400, 'INVALID_REQUEST', message);
}

function scalar(query: Query, key: string): string | undefined {
  const value = query[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return invalid(`${key} must be a single text value.`);
  return value.trim();
}

function allowedKeys(query: Query, allowed: string[]): void {
  if (Object.keys(query).some((key) => !allowed.includes(key))) {
    invalid('Unsupported query parameter. Use only the documented location and outfit preferences.');
  }
}

function placeName(value: string | undefined, name: string): string {
  if (!value || value.length < 2 || value.length > 120 || /[\u0000-\u001f\u007f]/.test(value)) {
    return invalid(`${name} must contain 2 to 120 characters.`);
  }
  return value;
}

function coordinate(value: string | undefined, name: string, limit: number): number {
  if (!value || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) {
    return invalid(`${name} must be a valid decimal coordinate.`);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < -limit || number > limit) {
    return invalid(`${name} must be between ${-limit} and ${limit}.`);
  }
  return number;
}

export function parseOutfitQuery(query: Query): OutfitRequest {
  allowedKeys(query, ['city', 'lat', 'lon', 'style', 'comfort']);
  const city = scalar(query, 'city');
  const lat = scalar(query, 'lat');
  const lon = scalar(query, 'lon');
  const style = scalar(query, 'style') ?? 'unisex';
  const comfort = scalar(query, 'comfort') ?? 'neutral';
  if (!['unisex', 'male', 'female'].includes(style)) invalid('style must be unisex, male, or female.');
  if (!['cooler', 'neutral', 'warmer'].includes(comfort)) invalid('comfort must be cooler, neutral, or warmer.');
  const preferences = { style: style as OutfitStyle, comfort: comfort as TemperatureComfort };

  if (city !== undefined) {
    if (lat !== undefined || lon !== undefined) invalid('Provide a city or coordinates, not both.');
    return { city: placeName(city, 'city'), ...preferences };
  }
  if (lat === undefined || lon === undefined) invalid('Provide a city or both lat and lon.');
  return { lat: coordinate(lat, 'lat', 90), lon: coordinate(lon, 'lon', 180), ...preferences };
}

export function parseLocationsQuery(query: Query): { q: string; limit: number } {
  allowedKeys(query, ['q', 'limit']);
  const q = placeName(scalar(query, 'q'), 'q');
  const rawLimit = scalar(query, 'limit') ?? '5';
  if (!/^[1-5]$/.test(rawLimit)) invalid('limit must be an integer from 1 to 5.');
  return { q, limit: Number(rawLimit) };
}
