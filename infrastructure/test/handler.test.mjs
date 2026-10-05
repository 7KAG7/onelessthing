import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHandler, createSecretLoader } from '../.build/handler.js';

function event(path, options = {}) {
  return {
    version: '2.0',
    rawPath: path,
    rawQueryString: options.query ?? '',
    headers: options.headers ?? {},
    requestContext: {
      http: { method: options.method ?? 'GET' },
      ...(options.auth ? { authorizer: { jwt: options.auth } } : {}),
    },
  };
}
const body = (result) => JSON.parse(result.body);
const noSecrets = () => { throw new Error('This route must not retrieve a secret'); };
const authenticated = { claims: { sub: 'cognito-user-123', token_use: 'access' }, scopes: ['onelessthing/user'] };

test('health is explicit about unwired cloud sync, with no secrets/network', async () => {
  const result = await createHandler({ loadApiKey: noSecrets })(event('/api/v1/health'));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(body(result), { apiVersion: '1', status: 'ok', cloudSync: false });
  assert.equal(result.headers['cache-control'], 'private, no-store');
});

test('unsupported paths and public mutations cannot reach the weather provider', async () => {
  const handler = createHandler({ loadApiKey: noSecrets });
  for (const input of [event('/api/auth/login'), event('/api/v1/outfit', { method: 'POST' }), event('/api/v1/health', { method: 'PUT' })]) {
    assert.equal((await handler(input)).statusCode, 404);
  }
});

test('unsigned header or query claims do not authorize private routes', async () => {
  const result = await createHandler({ loadApiKey: noSecrets })(event('/api/v1/me', {
    query: 'userId=someone-else&sub=cognito-user-123',
    headers: { authorization: 'Bearer fake', 'x-user-id': 'cognito-user-123' },
  }));
  assert.equal(result.statusCode, 401);
});

test('private routes require access-token claims and the custom scope', async () => {
  const handler = createHandler({ loadApiKey: noSecrets });
  for (const auth of [
    { ...authenticated, claims: { ...authenticated.claims, token_use: 'id' } },
    { ...authenticated, scopes: ['openid'] },
    { ...authenticated, claims: { token_use: 'access' } },
  ]) assert.equal((await handler(event('/api/v1/me', { auth }))).statusCode, 401);
});

test('authenticated cloud-sync placeholders return 501, never invented saved data', async () => {
  const handler = createHandler({ loadApiKey: noSecrets });
  for (const path of ['/api/v1/me', '/api/v1/saved-outfits', '/api/v1/saved-outfits/look-123']) {
    const result = await handler(event(path, { auth: authenticated }));
    assert.equal(result.statusCode, 501);
    assert.equal(body(result).error.code, 'CLOUD_SYNC_NOT_IMPLEMENTED');
  }
});

test('URL decoding preserves legitimate commas, rejects duplicate query parameters', async () => {
  let received;
  const handler = createHandler({
    loadApiKey: async () => 'test-only',
    apiFactory: () => ({ outfit: async (query) => { received = query; return { apiVersion: '1' }; }, locations: noSecrets }),
  });
  assert.equal((await handler(event('/api/v1/outfit', { query: 'city=Boston%2CUS&comfort=warmer' }))).statusCode, 200);
  assert.equal(received.city, 'Boston,US');
  const duplicate = await createHandler({ loadApiKey: noSecrets })(event('/api/v1/outfit', { query: 'city=Boston&city=London' }));
  assert.equal(duplicate.statusCode, 400);
});

test('uses both shared service methods and refreshes the service when its key rotates', async () => {
  let key = 'first';
  const keys = [];
  const calls = [];
  const handler = createHandler({
    loadApiKey: async () => key,
    apiFactory: (apiKey) => {
      keys.push(apiKey);
      return {
        outfit: async (query) => { calls.push(['outfit', query.city]); return { apiVersion: '1' }; },
        locations: async (query) => { calls.push(['locations', query.q]); return { apiVersion: '1', locations: [] }; },
      };
    },
  });
  await handler(event('/api/v1/outfit', { query: 'city=Boston' }));
  await handler(event('/api/v1/locations', { query: 'q=Boston' }));
  key = 'second';
  await handler(event('/api/v1/outfit', { query: 'city=London' }));
  assert.deepEqual(keys, ['first', 'second']);
  assert.deepEqual(calls, [['outfit', 'Boston'], ['locations', 'Boston'], ['outfit', 'London']]);
});

test('secret failures return a retryable error without leaking credentials or SDK details', async () => {
  const result = await createHandler({ loadApiKey: async () => { throw new Error('arn:private SECRET_VALUE'); } })(event('/api/v1/outfit', { query: 'city=Boston' }));
  assert.equal(result.statusCode, 503);
  assert.equal(body(result).error.retryable, true);
  assert.doesNotMatch(result.body, /arn:private|SECRET_VALUE/);
});

test('unexpected service errors are sanitized by the shared error contract', async () => {
  const result = await createHandler({
    loadApiKey: async () => 'test-only',
    apiFactory: () => ({ outfit: async () => { throw new Error('SECRET_VALUE https://private'); }, locations: noSecrets }),
  })(event('/api/v1/outfit'));
  assert.equal(result.statusCode, 500);
  assert.doesNotMatch(result.body, /SECRET_VALUE|https:\/\/private/);
});

test('real shared validation works in the packaged Lambda without any network request', async () => {
  const result = await createHandler({ loadApiKey: async () => 'test-only' })(event('/api/v1/outfit', { query: 'lat=999&lon=0' }));
  assert.equal(result.statusCode, 400);
  assert.equal(body(result).error.code, 'INVALID_REQUEST');
});

test('secret loader caches, deduplicates cold starts, and expires after five minutes', async () => {
  let now = 1000;
  let reads = 0;
  const load = createSecretLoader({
    secretArn: 'arn:test-only',
    now: () => now,
    readSecret: async () => { reads++; return JSON.stringify({ OPENWEATHER_API_KEY: `key-${reads}` }); },
  });
  assert.deepEqual(await Promise.all([load(), load(), load()]), ['key-1', 'key-1', 'key-1']);
  assert.equal(reads, 1);
  now += 299999;
  assert.equal(await load(), 'key-1');
  now += 1;
  assert.equal(await load(), 'key-2');
  assert.equal(reads, 2);
});

test('invalid secret failures are not cached indefinitely', async () => {
  let reads = 0;
  const load = createSecretLoader({
    secretArn: 'arn:test-only',
    readSecret: async () => { reads++; return reads === 1 ? '{"wrongField":"value"}' : '{"OPENWEATHER_API_KEY":"fixed"}'; },
  });
  await assert.rejects(load());
  assert.equal(await load(), 'fixed');
  assert.equal(reads, 2);
});

test('missing secret ARN fails before using an AWS SDK', async () => {
  await assert.rejects(createSecretLoader({ secretArn: '', readSecret: noSecrets })());
});
