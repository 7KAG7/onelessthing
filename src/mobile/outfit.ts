import { MobileWeather, OutfitResponse, OutfitStyle, TemperatureComfort } from './contracts';

export interface BasePiece { name: string; reason: string }
export interface BaseOutfit {
  head: BasePiece;
  torso: BasePiece;
  bottoms: BasePiece;
  footwear: BasePiece;
  accessories: BasePiece[];
}

/** Shared with the original website. Temperature and wind are Fahrenheit and mph. */
export function suggestBaseOutfit(temp: number, condition: string, windSpeed: number): BaseOutfit {
  const cond = condition.toLowerCase();
  let tiles: BaseOutfit;
  if (temp <= 40) {
    tiles = {
      head: { name: 'Warm hat', reason: 'Cold: 40°F or below' },
      torso: { name: 'Insulated jacket', reason: 'Cold' },
      bottoms: { name: 'Warm pants', reason: 'Cold' },
      footwear: { name: 'Boots', reason: 'Cold' },
      accessories: []
    };
  } else if (temp <= 60) {
    tiles = {
      head: { name: 'Beanie or cap', reason: 'Cool' },
      torso: { name: 'Light jacket or sweater', reason: 'Cool' },
      bottoms: { name: 'Jeans', reason: 'Cool' },
      footwear: { name: 'Sneakers', reason: 'Cool' },
      accessories: []
    };
  } else {
    tiles = {
      head: { name: 'Cap or sunhat', reason: 'Warm' },
      torso: { name: 'T-shirt or top', reason: 'Warm' },
      bottoms: { name: 'Shorts or light pants', reason: 'Warm' },
      footwear: { name: 'Sandals or sneakers', reason: 'Warm' },
      accessories: []
    };
  }
  if (cond.includes('snow')) {
    tiles.accessories.push({ name: 'Snow gloves', reason: 'Snow' });
  } else if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('storm')) {
    tiles.accessories.push({ name: 'Umbrella', reason: 'Rainy' });
  } else if (temp <= 40) {
    tiles.accessories.push({ name: 'Gloves', reason: 'Cold' });
  } else if (windSpeed >= 15) {
    tiles.accessories.push({ name: 'Light scarf', reason: 'Windy' });
  } else if (temp >= 70 || cond.includes('clear')) {
    tiles.accessories.push({ name: 'Sunglasses', reason: 'Bright or warm' });
  } else {
    tiles.accessories.push({ name: 'Light scarf', reason: 'Mild weather' });
  }
  return tiles;
}

export function buildOutfit(
  weather: MobileWeather,
  style: OutfitStyle,
  comfort: TemperatureComfort,
  affiliateTag = ''
): OutfitResponse['outfit'] {
  // Preference is about clothing warmth, not an inferred identity or health trait.
  const adjustment = comfort === 'warmer' ? -7 : comfort === 'cooler' ? 7 : 0;
  const effectiveTemperatureF = Math.round((weather.feelsLikeF + adjustment) * 10) / 10;
  const base = suggestBaseOutfit(effectiveTemperatureF, weather.condition, weather.windMph);
  const wet = ['rain', 'storm', 'snow'].includes(weather.condition);
  if (wet) {
    base.footwear = { name: 'Weatherproof boots', reason: 'Keep your feet dry in wet conditions' };
    if (effectiveTemperatureF > 40) {
      base.torso = { name: 'Light waterproof jacket', reason: 'A light shell keeps the rain out' };
    } else {
      base.torso = { name: 'Insulated waterproof jacket', reason: 'Warmth and protection from wet weather' };
    }
  }

  const items = [
    { id: 'head', category: 'head' as const, ...base.head },
    { id: 'top', category: 'top' as const, ...base.torso },
    { id: 'bottoms', category: 'bottoms' as const, ...base.bottoms },
    { id: 'footwear', category: 'footwear' as const, ...base.footwear },
    ...base.accessories.map((item, index) => ({ id: `accessory-${index + 1}`, category: 'accessory' as const, ...item }))
  ];
  const audience = style === 'male' ? 'mens' : style === 'female' ? 'womens' : 'unisex';
  const pieces = items.map((item) => {
    const url = new URL('https://www.amazon.com/s');
    url.searchParams.set('k', `${audience} ${item.name} clothing`);
    if (affiliateTag) url.searchParams.set('tag', affiliateTag);
    return { ...item, searchUrl: url.toString() };
  });
  const title = wet ? 'Ready for wet weather' : effectiveTemperatureF <= 40
    ? 'Wrap up and head out'
    : effectiveTemperatureF <= 60 ? 'A little layer goes a long way' : 'Keep it light and easy';
  const preferenceNote = comfort === 'neutral' ? '' : ` Adjusted for ${comfort} clothing.`;
  const summary = `Feels like ${Math.round(weather.feelsLikeF)}°F with ${weather.description.toLowerCase()}.${preferenceNote}`;
  const tips = ['Based on current conditions. Check the forecast before a longer day outside.'];
  if (wet) tips.push('Choose a water-resistant outer layer and shoes with grip.');
  if (weather.windMph >= 15) tips.push('It is breezy. A wind-resistant outer layer will help.');
  if (weather.condition === 'storm') tips.push('If you hear thunder, head indoors and wait for the storm to pass.');
  if (weather.feelsLikeF >= 90) tips.push('Choose breathable layers and take breaks from the heat.');
  if (weather.feelsLikeF <= 20) tips.push('Add a warm base layer and cover exposed skin.');
  return { title, summary, effectiveTemperatureF, pieces, tips };
}
