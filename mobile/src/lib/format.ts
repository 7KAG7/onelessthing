import type { Unit, WeatherCondition } from './types';
export function temperature(valueF: number, unit: Unit): string {
  const value = unit === 'C' ? (valueF - 32) * 5 / 9 : valueF;
  return `${Math.round(value)}°`;
}
export function wind(valueMph: number, unit: Unit): string {
  return `${Math.round(unit === 'C' ? valueMph * 1.609344 : valueMph)} ${unit === 'C' ? 'km/h' : 'mph'}`;
}
export function localHour(time: string, offsetSeconds: number): string {
  const hour = new Date(Date.parse(time) + offsetSeconds * 1000).getUTCHours();
  return `${hour % 12 || 12}${hour >= 12 ? 'pm' : 'am'}`;
}
export function weatherIcon(condition: WeatherCondition, isDay = true) {
  switch (condition) {
    case 'rain': return 'rainy-outline' as const;
    case 'snow': return 'snow-outline' as const;
    case 'storm': return 'thunderstorm-outline' as const;
    case 'cloudy': return 'partly-sunny-outline' as const;
    case 'fog': return 'cloud-outline' as const;
    case 'clear': return isDay ? 'sunny-outline' as const : 'moon-outline' as const;
    default: return 'cloud-outline' as const;
  }
}

/** The API uses canonical Fahrenheit in its explanation text. Localize at display time. */
export function weatherText(text: string, unit: Unit): string {
  if (unit === 'F') return text;
  return text.replace(/(-?\d+(?:\.\d+)?)°F/g, (_, value: string) => `${Math.round((Number(value) - 32) * 5 / 9)}°C`);
}
