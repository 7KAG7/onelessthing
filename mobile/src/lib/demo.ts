import type { LocationRequest, MobileLocation, OutfitResponse, Preferences } from './types';
export const sampleLocations: MobileLocation[] = [
  { name: 'Boston', state: 'Massachusetts', country: 'US', lat: 42.36, lon: -71.06, label: 'Boston, Massachusetts, US' },
  { name: 'Seattle', state: 'Washington', country: 'US', lat: 47.61, lon: -122.33, label: 'Seattle, Washington, US' },
  { name: 'Austin', state: 'Texas', country: 'US', lat: 30.27, lon: -97.74, label: 'Austin, Texas, US' },
];
export function sampleOutfit(request: LocationRequest, preferences: Preferences): OutfitResponse {
  const location = sampleLocations.find(l => 'city' in request ? l.name.toLowerCase() === request.city.toLowerCase().split(',')[0].trim() : Math.abs(l.lat - request.lat) < .1) || sampleLocations[0];
  const rainy = location.name === 'Seattle';
  const hot = location.name === 'Austin';
  const temp = hot ? 82 : rainy ? 54 : 62;
  const warmLayers = preferences.comfort === 'warmer' || rainy;
  const lightLayers = preferences.comfort === 'cooler' || hot;
  const current = new Date();
  const start = new Date(current); start.setUTCMinutes(0,0,0);
  const piece = (id: string, category: 'head'|'top'|'bottoms'|'footwear'|'accessory', name: string, reason: string) => ({ id, category, name, reason,
    searchUrl: `https://www.amazon.com/s?k=${encodeURIComponent(`${preferences.style === 'male' ? 'mens' : preferences.style === 'female' ? 'womens' : 'unisex'} ${name}`)}` });
  return {
    apiVersion: '1', generatedAt: current.toISOString(), location,
    weather: { temperatureF: temp, feelsLikeF: temp - 2, condition: rainy ? 'rain' : hot ? 'clear' : 'cloudy', description: rainy ? 'Light rain' : hot ? 'Clear skies' : 'Partly cloudy', windMph: rainy ? 12 : 8, humidityPct: rainy ? 78 : 56, observedAt: current.toISOString(), isDay: true, timezoneOffsetSeconds: location.name === 'Boston' ? -14400 : rainy ? -25200 : -18000 },
    preferences: { style: preferences.style, comfort: preferences.comfort },
    outfit: {
      title: rainy ? 'A little rain. All covered.' : hot ? 'Keep it light today.' : 'Light layers. Easy day.',
      summary: rainy ? 'A water-resistant layer and closed shoes keep this day comfortable.' : hot ? 'Breathable fabrics and a little shade are your best friends.' : 'A soft layer for the breeze. Comfortable essentials for everything else.',
      effectiveTemperatureF: temp + (preferences.comfort === 'warmer' ? -5 : preferences.comfort === 'cooler' ? 5 : 0),
      pieces: [
        piece('head','head',hot ? 'Sun hat' : 'Everyday cap',hot ? 'A little shade when you are outside' : 'An easy extra for a breezy walk'),
        piece('top','top',rainy ? 'Rain jacket' : warmLayers ? 'Soft knit sweater' : lightLayers ? 'Breathable T-shirt' : 'Light overshirt',rainy ? 'A light barrier against showers' : warmLayers ? 'A warmer layer for your comfort preference' : 'Comfortable now, easy to layer later'),
        piece('bottoms','bottoms',hot ? 'Lightweight shorts' : 'Straight-leg trousers',hot ? 'Airy fabric for a warm afternoon' : 'An everyday staple with room to move'),
        piece('footwear','footwear',rainy ? 'Weatherproof boots' : 'Everyday sneakers',rainy ? 'Keep your feet dry on wet sidewalks' : 'A comfortable foundation for your day'),
        piece('accessory','accessory',rainy ? 'Compact umbrella' : 'Sunglasses',rainy ? 'Small enough to keep on hand' : 'For the brighter breaks in the clouds'),
      ],
      tips: [rainy ? 'Take an umbrella before heading out.' : hot ? 'Choose breathable fabrics for the afternoon.' : 'Keep your extra layer handy for the evening.'],
    },
    forecast: Array.from({length: 12}, (_, i) => ({ time: new Date(start.getTime() + (i + 1) * 3600000).toISOString(), temperatureF: temp + [0,2,3,4,3,1,0,-2,-4,-5,-6,-6][i], precipitationChancePct: rainy ? [65,80,70,55,40,30,25,20,20,15,10,10][i] : [10,10,5,5,0,5,10,10,15,15,10,5][i], condition: rainy ? 'rain' : hot ? 'clear' : 'cloudy', windMph: 8 })),
    warnings: [],
  };
}
