import type { OutfitResponse, OutfitStyle, TemperatureComfort } from '../../../src/mobile/contracts';
export type {
  OutfitResponse, MobileLocation, MobileWeather, ForecastHour, OutfitPiece,
  OutfitStyle, TemperatureComfort, WeatherCondition, OutfitCategory,
} from '../../../src/mobile/contracts';

export type Unit = 'F' | 'C';
export interface Preferences {
  style: OutfitStyle;
  comfort: TemperatureComfort;
  unit: Unit;
  city: string;
  location?: { lat: number; lon: number };
}
export interface SavedOutfit { id: string; savedAt: string; sample: boolean; data: OutfitResponse }
export type LocationRequest = { city: string } | { lat: number; lon: number };
