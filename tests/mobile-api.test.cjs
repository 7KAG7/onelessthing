const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createMobileApi, MobileApiError, toErrorResponse } = require('../dist/mobile/api');
const { createMobileRouter } = require('../dist/mobile/router');
const { parseOutfitQuery, parseLocationsQuery } = require('../dist/mobile/validation');
const { normalizeCurrentWeather, normalizeLocations, normalizeForecast, normalizeCondition } = require('../dist/mobile/normalize');
const { suggestBaseOutfit, buildOutfit } = require('../dist/mobile/outfit');

const NOW = new Date('2026-10-04T17:30:00.000Z');
const now = () => new Date(NOW);
const current = () => ({
  name: 'Boston', coord: { lat: 42.36, lon: -71.06 }, timezone: -14400,
  sys: { country: 'US', sunrise: 1791108000, sunset: 1791154800 },
  dt: Math.floor(NOW.getTime() / 1000),
  main: { temp: 59.34, feels_like: 56.82, humidity: 73 },
  wind: { speed: 8.93 },
  weather: [{ id: 500, main: 'Rain', description: 'light rain', icon: '10d' }]
});
const hourly = () => ({ hourly: {
  time: ['2026-10-04T17:00', '2026-10-04T18:00', '2026-10-04T19:00'],
  temperature_2m: [58, 60, 61], precipitation_probability: [25, 40, 80],
  wind_speed_10m: [8, 9, 10], weather_code: [1, 3, 61]
} });
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' }
});
function providerFetch(calls = []) {
  return async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    if (url.hostname === 'api.open-meteo.com') return json(hourly());
    if (url.pathname.includes('/geo/')) return json([
      { name: 'Boston', state: 'Massachusetts', country: 'US', lat: 42.36, lon: -71.06 }
    ]);
    return json(current());
  };
}

test('location queries default preferences and accept zero and edge coordinates', () => {
  assert.deepEqual(parseOutfitQuery({ city: '  Boston,US  ' }), {
    city: 'Boston,US', style: 'unisex', comfort: 'neutral'
  });
  assert.deepEqual(parseOutfitQuery({ lat: '0', lon: '0', style: 'female', comfort: 'warmer' }), {
    lat: 0, lon: 0, style: 'female', comfort: 'warmer'
  });
  assert.equal(parseOutfitQuery({ lat: '-90', lon: '180' }).lat, -90);
  assert.deepEqual(parseLocationsQuery({ q: 'München' }), { q: 'München', limit: 5 });
});

test('validation rejects ambiguous, repeated, malformed, and identity parameters', () => {
  const invalid = [
    {}, { city: '' }, { city: 'A' }, { city: 'x'.repeat(121) }, { city: 'New\nYork' },
    { city: ['Boston', 'London'] }, { city: { toString: 'Boston' } },
    { lat: '42' }, { lon: '42' }, { lat: 'NaN', lon: '0' }, { lat: 'Infinity', lon: '0' },
    { lat: '91', lon: '0' }, { lat: '0', lon: '-181' }, { lat: '1e2', lon: '0' },
    { lat: '', lon: '0' }, { city: 'Boston', lat: '0', lon: '0' },
    { city: 'Boston', style: 'identity' }, { city: 'Boston', comfort: 'hot' },
    { city: 'Boston', gender: 'female' }, { city: 'Boston', age: '37' },
    { city: 'Boston', ageRange: 'adult' }
  ];
  for (const query of invalid) {
    assert.throws(() => parseOutfitQuery(query), (error) => error.status === 400 && error.code === 'INVALID_REQUEST', JSON.stringify(query));
  }
  for (const query of [{}, { q: 'A' }, { q: 'London', limit: '0' }, { q: 'London', limit: '6' }, { q: 'London', limit: '1.5' }, { q: ['Boston'] }]) {
    assert.throws(() => parseLocationsQuery(query), MobileApiError);
  }
});

test('current weather is normalized to explicit units and safe fields', () => {
  const raw = current();
  raw.secret = 'DO_NOT_RETURN';
  const result = normalizeCurrentWeather(raw, NOW);
  assert.deepEqual(result.location, { name: 'Boston', state: null, country: 'US', lat: 42.36, lon: -71.06, label: 'Boston, US' });
  assert.deepEqual(result.weather, {
    temperatureF: 59.3, feelsLikeF: 56.8, condition: 'rain', description: 'light rain',
    windMph: 8.9, humidityPct: 73, observedAt: NOW.toISOString(), isDay: true, timezoneOffsetSeconds: -14400
  });
  assert.ok(!JSON.stringify(result).includes('DO_NOT_RETURN'));
  raw.weather[0].icon = '10n';
  assert.equal(normalizeCurrentWeather(raw, NOW).weather.isDay, false);
});

test('missing or invalid required provider values are never fabricated as zero', () => {
  for (const mutate of [
    (raw) => { raw.main.temp = null; },
    (raw) => { raw.main.feels_like = '56'; },
    (raw) => { raw.coord.lat = 100; },
    (raw) => { raw.wind.speed = undefined; },
    (raw) => { raw.main.humidity = 101; },
    (raw) => { raw.dt = null; }
  ]) {
    const raw = current(); mutate(raw);
    assert.throws(() => normalizeCurrentWeather(raw, NOW), (error) => error.code === 'INVALID_UPSTREAM_RESPONSE');
  }
});

test('weather conditions cover wet, clear, cloudy, fog and unknown cases', () => {
  for (const [code, expected] of [[211, 'storm'], [301, 'rain'], [502, 'rain'], [601, 'snow'], [741, 'fog'], [800, 'clear'], [803, 'cloudy']]) {
    assert.equal(normalizeCondition(code, ''), expected);
  }
  assert.equal(normalizeCondition(null, 'Drizzle'), 'rain');
  assert.equal(normalizeCondition(null, 'Unknown'), 'mixed');
});

test('base recommendation preserves legacy 40°F and 60°F boundaries', () => {
  assert.equal(suggestBaseOutfit(40, 'clear', 0).torso.name, 'Insulated jacket');
  assert.equal(suggestBaseOutfit(40.1, 'clear', 0).torso.name, 'Light jacket or sweater');
  assert.equal(suggestBaseOutfit(60, 'clear', 0).torso.name, 'Light jacket or sweater');
  assert.equal(suggestBaseOutfit(60.1, 'clear', 0).torso.name, 'T-shirt or top');
  assert.equal(suggestBaseOutfit(50, 'Thunderstorm', 0).accessories[0].name, 'Umbrella');
  assert.equal(suggestBaseOutfit(30, 'Snow', 0).accessories[0].name, 'Snow gloves');
});

test('comfort changes clothing warmth, while style only changes shopping search audience', () => {
  const weather = { ...normalizeCurrentWeather(current(), NOW).weather, condition: 'cloudy', feelsLikeF: 62 };
  const warmer = buildOutfit(weather, 'female', 'warmer', 'example-20');
  const cooler = buildOutfit(weather, 'unisex', 'cooler');
  assert.equal(warmer.effectiveTemperatureF, 55);
  assert.equal(cooler.effectiveTemperatureF, 69);
  assert.equal(warmer.pieces.find((item) => item.category === 'top').name, 'Light jacket or sweater');
  assert.equal(cooler.pieces.find((item) => item.category === 'top').name, 'T-shirt or top');
  const link = new URL(warmer.pieces[0].searchUrl);
  assert.equal(link.protocol, 'https:');
  assert.equal(link.hostname, 'www.amazon.com');
  assert.ok(link.searchParams.get('k').startsWith('womens '));
  assert.equal(link.searchParams.get('tag'), 'example-20');
  assert.ok(!new URL(cooler.pieces[0].searchUrl).searchParams.has('tag'));
});

test('wet and extreme weather adds appropriate layers and useful tips', () => {
  const weather = normalizeCurrentWeather(current(), NOW).weather;
  const wet = buildOutfit(weather, 'unisex', 'neutral');
  assert.equal(wet.pieces.find((item) => item.category === 'footwear').name, 'Weatherproof boots');
  assert.equal(wet.pieces.find((item) => item.category === 'top').name, 'Light waterproof jacket');
  const coldStorm = buildOutfit({ ...weather, condition: 'storm', windMph: 20, feelsLikeF: 10 }, 'male', 'neutral');
  assert.ok(coldStorm.tips.some((tip) => tip.includes('head indoors')));
  assert.ok(coldStorm.tips.some((tip) => tip.includes('base layer')));
  assert.equal(new Set(coldStorm.pieces.map((piece) => piece.id)).size, coldStorm.pieces.length);
});

test('geocoding filters invalid coordinates, deduplicates and respects limit', () => {
  const entry = { name: 'Boston', country: 'US', state: 'Massachusetts', lat: 42.36, lon: -71.06 };
  const result = normalizeLocations([entry, entry, { ...entry, lat: 99 }, { name: 'Missing' }, { ...entry, name: 'Cambridge' }], 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].label, 'Boston, Massachusetts, US');
  assert.deepEqual(normalizeLocations([], 5), []);
  assert.throws(() => normalizeLocations({ error: 'oops' }, 5), MobileApiError);
});

test('forecast filters past/invalid/duplicate hours and sorts timestamps', () => {
  const fixture = hourly();
  fixture.hourly.time.push('2026-10-04T18:00', '2026-10-05T20:00', 'not-a-date');
  fixture.hourly.temperature_2m.push(99, 99, 99);
  fixture.hourly.precipitation_probability.push(1, 1, 1);
  fixture.hourly.wind_speed_10m.push(1, 1, 1);
  fixture.hourly.weather_code.push(0, 0, 0);
  const result = normalizeForecast(fixture, NOW);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { time: '2026-10-04T18:00:00.000Z', temperatureF: 60, precipitationChancePct: 40, condition: 'cloudy', windMph: 9 });
  assert.equal(result[1].condition, 'rain');
  fixture.hourly.temperature_2m[1] = null;
  assert.equal(normalizeForecast(fixture, NOW)[0].temperatureF, 99);
});

test('outfit service returns the mobile contract and encodes only bounded provider inputs', async () => {
  const calls = [];
  const api = createMobileApi({ apiKey: 'test-secret', now, fetchImpl: providerFetch(calls) });
  const result = await api.outfit({ city: 'Boston&appid=injected', style: 'unisex', comfort: 'neutral' });
  assert.equal(result.apiVersion, '1');
  assert.equal(result.generatedAt, NOW.toISOString());
  assert.equal(result.forecast.length, 2);
  assert.deepEqual(result.warnings, []);
  assert.equal(calls[0].url.searchParams.get('q'), 'Boston&appid=injected');
  assert.deepEqual(calls[0].url.searchParams.getAll('appid'), ['test-secret']);
  assert.equal(calls[0].url.searchParams.get('units'), 'imperial');
  assert.equal(calls[0].init.redirect, 'error');
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.equal(calls[1].url.searchParams.get('timezone'), 'UTC');
  assert.ok(!JSON.stringify(result).includes('test-secret'));
});

test('coordinates avoid geocoding and zero coordinates remain valid', async () => {
  const calls = [];
  const api = createMobileApi({ apiKey: 'test', now, fetchImpl: providerFetch(calls) });
  await api.outfit({ lat: '0', lon: '0' });
  assert.equal(calls[0].url.searchParams.get('lat'), '0');
  assert.equal(calls[0].url.searchParams.get('lon'), '0');
  assert.ok(!calls[0].url.searchParams.has('q'));
});

test('missing key and invalid request make no network calls', async () => {
  let calls = 0;
  const api = createMobileApi({ apiKey: '', fetchImpl: async () => { calls += 1; throw new Error(); } });
  await assert.rejects(api.outfit({ city: 'Boston' }), (error) => error.status === 503);
  await assert.rejects(api.locations({ q: 'Boston' }), (error) => error.status === 503);
  await assert.rejects(api.outfit({ city: ['Boston'] }), (error) => error.status === 400);
  assert.equal(calls, 0);
});

test('upstream 404, server errors and invalid JSON have safe error contracts', async () => {
  for (const [response, status, code] of [
    [json({ message: 'provider private detail' }, 404), 404, 'LOCATION_NOT_FOUND'],
    [json({ message: 'provider private detail' }, 401), 502, 'UPSTREAM_UNAVAILABLE'],
    [json({ message: 'provider private detail' }, 429), 502, 'UPSTREAM_UNAVAILABLE'],
    [new Response('<invalid>', { status: 200 }), 502, 'INVALID_UPSTREAM_RESPONSE']
  ]) {
    const api = createMobileApi({ apiKey: 'never-return-me', fetchImpl: async () => response });
    await assert.rejects(api.outfit({ city: 'Boston' }), (error) => {
      const mapped = toErrorResponse(error);
      assert.equal(mapped.status, status);
      assert.equal(mapped.body.error.code, code);
      assert.ok(!JSON.stringify(mapped).includes('private detail'));
      assert.ok(!JSON.stringify(mapped).includes('never-return-me'));
      return true;
    });
  }
  const mapped = toErrorResponse(new Error('secret stack trace'));
  assert.equal(mapped.status, 500);
  assert.ok(!JSON.stringify(mapped).includes('secret'));
});

test('current request deadline aborts even an unresponsive fetch implementation', async () => {
  let signal;
  const api = createMobileApi({ apiKey: 'test', timeoutMs: 5, fetchImpl: async (_url, init) => {
    signal = init.signal;
    return new Promise(() => {});
  } });
  await assert.rejects(api.outfit({ city: 'Boston' }), (error) => error.status === 504 && error.code === 'UPSTREAM_TIMEOUT');
  assert.equal(signal.aborted, true);
});

test('request deadline also covers a stalled response body', async () => {
  const api = createMobileApi({ apiKey: 'test', timeoutMs: 5, fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }) });
  await assert.rejects(api.outfit({ city: 'Boston' }), (error) => error.code === 'UPSTREAM_TIMEOUT');
});

test('forecast failures and malformed forecast preserve current outfit with a warning', async () => {
  for (const badForecast of [() => json({}, 503), () => json({ hourly: {} }), () => { throw new Error('private provider failure'); }]) {
    const api = createMobileApi({ apiKey: 'test', now, fetchImpl: async (url) => {
      return String(url).includes('open-meteo') ? badForecast() : json(current());
    } });
    const result = await api.outfit({ city: 'Boston' });
    assert.ok(result.outfit.pieces.length >= 4);
    assert.deepEqual(result.forecast, []);
    assert.equal(result.warnings.length, 1);
    assert.ok(!JSON.stringify(result).includes('private provider failure'));
  }
});

test('forecast timeout degrades gracefully instead of failing the outfit', async () => {
  const api = createMobileApi({ apiKey: 'test', now, timeoutMs: 5, fetchImpl: async (url) => {
    return String(url).includes('open-meteo') ? new Promise(() => {}) : json(current());
  } });
  const result = await api.outfit({ city: 'Boston' });
  assert.deepEqual(result.forecast, []);
  assert.equal(result.warnings.length, 1);
});

test('versioned HTTP routes expose success, search, validation and private cache policy', async (t) => {
  const calls = [];
  const app = express();
  app.use('/api/v1', createMobileRouter({ apiKey: 'test', now, fetchImpl: providerFetch(calls) }));
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${origin}/api/v1/outfit?city=Boston&style=female&comfort=warmer`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = await response.json();
  assert.equal(body.preferences.style, 'female');
  assert.equal(body.preferences.comfort, 'warmer');
  assert.equal(body.apiVersion, '1');
  const locations = await fetch(`${origin}/api/v1/locations?q=Boston&limit=3`);
  assert.equal(locations.status, 200);
  assert.equal((await locations.json()).locations[0].state, 'Massachusetts');
  const duplicated = await fetch(`${origin}/api/v1/outfit?city=Boston&city=London`);
  assert.equal(duplicated.status, 400);
  assert.equal((await duplicated.json()).error.code, 'INVALID_REQUEST');
  const identity = await fetch(`${origin}/api/v1/outfit?city=Boston&age=37`);
  assert.equal(identity.status, 400);
  assert.equal(calls.length, 3, 'only valid current weather, forecast, and search call providers');
});
