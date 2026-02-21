export type WeatherLoopVariant =
  | 'clear-day'
  | 'clear-night'
  | 'partly-cloudy-day'
  | 'partly-cloudy-night'
  | 'overcast'
  | 'rain-light'
  | 'rain-heavy'
  | 'storm'
  | 'snow'
  | 'fog'
  | 'windy'

export const WEATHER_LOOP_SECONDS = 8

export const VARIANT_TO_ID: Record<WeatherLoopVariant, number> = {
  'clear-day': 0,
  'clear-night': 1,
  'partly-cloudy-day': 2,
  'partly-cloudy-night': 3,
  overcast: 4,
  'rain-light': 5,
  'rain-heavy': 6,
  storm: 7,
  snow: 8,
  fog: 9,
  windy: 10
}
