# Mobile API v1

The provider-independent TypeScript contract is in [`contracts.ts`](./contracts.ts).
The service in [`api.ts`](./api.ts) runs without Express, a filesystem, or an account
store. [`router.ts`](./router.ts) mounts the same service in the existing Node
server. The original website and `/api/weather` and `/api/locations` remain available.

## Outfit

`GET /api/v1/outfit?city=Boston,US&style=unisex&comfort=neutral`

Alternatively, supply both `lat` and `lon` instead of `city`. Zero coordinates are
valid. Sending both a city and coordinates is rejected. A city is 2–120 characters;
latitude must be -90 to 90 and longitude -180 to 180.

- `style`: `unisex` (default), `male`, or `female`. This selects a clothing search
  audience, not a gender identity
- `comfort`: `neutral` (default), `cooler`, or `warmer`. Warmer requests warmer
  clothing by subtracting 7°F from the feels-like temperature used by the outfit
  rules; cooler adds 7°F. The actual weather values are never altered
- No age, gender-identity, account, or profile parameters are accepted
- Repeated, structured, and undocumented query parameters are rejected

The result includes normalized current `weather`, `location`, the applied
`preferences`, an `outfit`, and up to 24 upcoming hourly entries in `forecast`.
Temperatures are Fahrenheit, wind is mph, precipitation chance is 0–100, and
timestamps are ISO 8601 UTC. `weather.timezoneOffsetSeconds` supports local-time
display. The offset describes the current weather observation, not a future
daylight-saving time transition.

Outfits use **current feels-like weather**, rather than the entire day's forecast.
Optional hourly-forecast failures return `forecast: []` and a non-empty `warnings`
array while preserving the current outfit. An unavailable or invalid current
weather response fails the request instead of returning invented conditions.

`searchUrl` is an HTTPS Amazon search link, not a verified product, price, or stock
listing. If configured, `AMAZON_ASSOCIATE_TAG` is applied to these links. Consumers
should disclose affiliate links when used and must not imply a purchase occurred.

## Location search

`GET /api/v1/locations?q=Boston&limit=5`

`q` must be 2–120 characters. `limit` is an integer from 1–5, default 5. An empty
result is valid. Locations include a display label, optional state (`null` when
unavailable), country, latitude, and longitude. Invalid coordinates are discarded
and equivalent suggestions deduplicated.

## Error envelope

All handled failures have this structure:

```json
{
  "apiVersion": "1",
  "error": {
    "code": "LOCATION_NOT_FOUND",
    "message": "We could not find that location. Try a nearby city.",
    "retryable": false
  }
}
```

Status codes: 400 invalid request; 404 unknown location; 503 live weather not
configured; 504 upstream timeout; 502 upstream unavailable/invalid; 500 unexpected
internal error. Upstream response bodies, URLs, API keys, and stack traces are not
returned to the caller.

## Runtime adapters and privacy

Construct `createMobileApi({ apiKey, affiliateTag?, timeoutMs?, fetchImpl?, now? })`
and call its `outfit(query)` or `locations(query)` methods. Catch failures with
`toErrorResponse(error)` to obtain `{ status, body }` for any HTTP adapter. A Lambda
adapter can bundle the service directly; it should preserve duplicate query values
so that validation can reject them.

The default deadline is 5 seconds per upstream request, including its response
body. Outfit retrieval can take about 10 seconds when the optional forecast also
times out. Redirects are disabled and provider hosts are fixed. Express responses
are marked `Cache-Control: private, no-store`.

The service sends city/coordinates to OpenWeather, and resolved coordinates to
Open-Meteo for forecast data. It never stores location, preferences, or history,
and never accesses `data/users.json`. API gateways, proxies, and deployment logging
must also avoid recording location query strings. Mobile clients should explain
provider use before requesting device location.

## Tests

From the repository root: `npm run test:api` and `npm run typecheck`.
Tests use deterministic provider fixtures and a loopback HTTP server. They require
no API keys and make no live provider requests or user-store writes.
