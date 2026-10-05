/** Versioned, provider-independent contract shared by mobile and HTTP adapters. */
export type OutfitStyle = 'unisex' | 'male' | 'female';
export type TemperatureComfort = 'cooler' | 'neutral' | 'warmer';
export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog' | 'mixed';
export type OutfitCategory = 'head' | 'top' | 'bottoms' | 'footwear' | 'accessory';

export interface MobileLocation {
  name: string;
  state: string | null;
  country: string;
  lat: number;
  lon: number;
  label: string;
}

export interface MobileWeather {
  temperatureF: number;
  feelsLikeF: number;
  condition: WeatherCondition;
  description: string;
  windMph: number;
  humidityPct: number;
  observedAt: string;
  isDay: boolean;
  timezoneOffsetSeconds: number;
}

export interface ForecastHour {
  time: string;
  temperatureF: number;
  precipitationChancePct: number;
  condition: WeatherCondition;
  windMph: number;
}

export interface OutfitPiece {
  id: string;
  category: OutfitCategory;
  name: string;
  reason: string;
  searchUrl: string;
}

export interface OutfitResponse {
  apiVersion: '1';
  generatedAt: string;
  location: MobileLocation;
  weather: MobileWeather;
  preferences: { style: OutfitStyle; comfort: TemperatureComfort };
  outfit: {
    title: string;
    summary: string;
    effectiveTemperatureF: number;
    pieces: OutfitPiece[];
    tips: string[];
  };
  forecast: ForecastHour[];
  /** Nonfatal service limitations. An unavailable forecast never hides the outfit. */
  warnings: string[];
}

export interface LocationsResponse {
  apiVersion: '1';
  locations: MobileLocation[];
}

export type MobileErrorCode =
  | 'INVALID_REQUEST'
  | 'LOCATION_NOT_FOUND'
  | 'SERVICE_UNAVAILABLE'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INVALID_UPSTREAM_RESPONSE'
  | 'INTERNAL_ERROR';

export interface MobileErrorResponse {
  apiVersion: '1';
  error: { code: MobileErrorCode; message: string; retryable: boolean };
}
