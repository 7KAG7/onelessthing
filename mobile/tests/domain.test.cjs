const test = require('node:test');
const assert = require('node:assert/strict');
const { sampleOutfit, sampleLocations } = require('../.test-dist/mobile/src/lib/demo.js');
const { isOutfit, safeShopUrl, restorePreferences, restoreSaved, outfitKey } = require('../.test-dist/mobile/src/lib/validation.js');
const { temperature, wind, localHour, weatherText } = require('../.test-dist/mobile/src/lib/format.js');
const preferences = { style: 'unisex', comfort: 'neutral', unit: 'F', city: '' };
const sample = () => sampleOutfit({ city: 'Boston' }, preferences);
test('every sample response obeys the mobile contract', () => {
  for (const location of sampleLocations) for (const comfort of ['cooler','neutral','warmer']) {
    const data = sampleOutfit({ lat: location.lat, lon: location.lon }, { ...preferences, comfort });
    assert.ok(isOutfit(data)); assert.equal(data.location.name, location.name);
    assert.equal(data.outfit.pieces.length, 5); assert.equal(data.forecast.length, 12);
  }
});
test('malformed API payloads and unsafe retailer links are rejected', () => {
  assert.equal(isOutfit({}), false);
  const bad = sample(); bad.weather.temperatureF = NaN; assert.equal(isOutfit(bad), false);
  for (const url of ['http://www.amazon.com/s?k=coat','https://www.amazon.com.evil.test/s','javascript:alert(1)','https://user:secret@www.amazon.com/s','https://www.amazon.com/redirect']) assert.equal(safeShopUrl(url), false);
  const injected = sample(); injected.outfit.pieces[0].searchUrl = 'https://evil.test/'; assert.equal(isOutfit(injected), false);
});
test('preference hydration is bounded and ignores unknown values', () => {
  assert.deepEqual(restorePreferences(null), preferences);
  assert.deepEqual(restorePreferences({ style:'unknown', comfort:'extreme', unit:'kelvin', city:'  Boston  ' }), { ...preferences, city:'Boston' });
  assert.equal(restorePreferences({ city: 'a'.repeat(999) }).city.length, 120);
});
test('invalid saved records do not break startup and saved collection is bounded', () => {
  assert.deepEqual(restoreSaved('broken'), []);
  const valid = { id:'saved', savedAt:new Date().toISOString(), sample:true, data:sample() };
  assert.equal(restoreSaved([null, {}, valid]).length, 1);
  assert.equal(restoreSaved(Array(40).fill(valid)).length, 30);
});
test('save keys distinguish sample, city and comfort, and prevent repeat saves', () => {
  const a = sample(); assert.equal(outfitKey(a,true), outfitKey(a,true));
  assert.notEqual(outfitKey(a,true), outfitKey(a,false));
  const b = sampleOutfit({ city:'Seattle' },preferences); assert.notEqual(outfitKey(a,true), outfitKey(b,true));
  const c = sampleOutfit({ city:'Boston' },{ ...preferences, comfort:'warmer' }); assert.notEqual(outfitKey(a,true), outfitKey(c,true));
});
test('temperature, wind and location-local hours format correctly', () => {
  assert.equal(temperature(32,'C'),'0°'); assert.equal(temperature(32,'F'),'32°');
  assert.equal(wind(10,'C'),'16 km/h'); assert.equal(wind(10,'F'),'10 mph');
  assert.equal(localHour('2026-10-05T01:00:00.000Z',-4*3600),'9pm');
  assert.equal(localHour('2026-10-05T12:00:00.000Z',0),'12pm');
});

test('stored locations preserve city identity without precise coordinates', () => {
  assert.deepEqual(restorePreferences({ location: { lat: 43.659123, lon: -70.256789 } }).location, { lat: 43.66, lon: -70.26 });
  assert.equal(restorePreferences({ location: { lat: 500, lon: 0 } }).location, undefined);
});
test('weather explanations honor the selected unit', () => {
  assert.equal(weatherText('Feels like 32°F; under 40°F.', 'C'), 'Feels like 0°C; under 4°C.');
  assert.equal(weatherText('Feels like 32°F.', 'F'), 'Feels like 32°F.');
});
