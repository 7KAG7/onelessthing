# One Less Thing: mobile product direction

## Recommendation

Keep this repository. Add a bare React Native app alongside the working Vite site, and evolve the backend behind a versioned API. A new repository would separate useful weather and recommendation logic prematurely; rewriting the web app or running it inside a WebView would also discard useful work or compromise the native experience.

The product promise is **one less decision before leaving home**. Lead with a comfortable outfit, explain the weather behind it, and keep shopping optional.

## Frontend

- React Native 0.86.3, TypeScript and React Navigation for iOS/Android. Native projects live in `mobile/ios/` and `mobile/android/`; iOS development and distribution use local Xcode. The existing Vite website remains the browser client.
- Calm warm-white surfaces, forest-green weather cards, muted botanical colors, editorial serif headings, generous spacing, and original vector garment illustrations. Color does not depend on the user's clothing selection.
- **Today:** city, current conditions, a complete outfit, reasons for each piece, a small practical reminder, and save action.
- **Forecast:** location-local hourly temperatures, precipitation chance and wind; useful when the day changes.
- **Saved:** up to 30 device-local outfit snapshots, clearly marked as historical or sample, with expand/remove controls.
- **You:** clothing-search selection, layer comfort and units. No date of birth, age, gender identity, or account is needed for the first useful result.
- Manual city search works without device permission. Approximate device location is an explicit action, with no background tracking. Search and network requests handle timeout, cancellation, empty results and stale/error states.
- Original illustrations communicate categories; they do not imply a real inventory, retailer product match, or an owned wardrobe. Affiliate links are disclosed immediately before shopping actions.

## Data and code boundaries

`mobile/src/navigation/` contains navigators and `mobile/src/app/` contains screens; `components/` contains presentation; `lib/` contains formatting, validation, sample data and HTTP access; `state/` handles device preferences and saved outfits. `src/mobile/contracts.ts` is the provider-neutral TypeScript contract shared by server and client, without importing server code into the app.

The client validates incoming responses and external shopping URLs at runtime. Failed live requests never silently become sample results. Sample mode is explicitly selected for development by leaving `apiBaseUrl` unset in `mobile/config/environment.json` and is labeled on all weather screens. The Xcode Release bundle phase runs `scripts/validate-release-config.cjs` to reject a missing or insecure API origin. Configure and verify the approved HTTPS API before preparing a release archive; sample data is not a production weather service.

A React context and serialized AsyncStorage writes are sufficient for this small initial app. As live accounts and multiple synchronized collections arrive, move server state to TanStack Query and use a durable local mutation/outbox layer. Do not introduce this complexity before there is a real sync workflow.

## Backend and AWS

1. **First integration:** deploy the versioned `/api/v1` endpoints alongside the existing Lightsail site, using its server-side weather credentials. This lets the app prove the product without a forced infrastructure migration.
2. **Staging target:** API Gateway HTTP API → Node.js 24 Lambda → OpenWeather/Open-Meteo. Scope the weather secret to Secrets Manager. SAM code in `infrastructure/` builds the same portable service used by Express.
3. **When accounts are needed:** Cognito public mobile client with authorization-code PKCE and platform-backed secure token storage; DynamoDB for scoped profiles and saved outfits. The scaffold's protected sync routes deliberately return `501 CLOUD_SYNC_NOT_IMPLEMENTED`. There is no fake login or cloud-save success.
4. **Operational readiness:** production logging without query data/tokens, measured provider quotas, bounded retries/timeouts, budget alarms and dashboards, and alerting for provider failure. Configure durable caching only after agreeing to provider licensing and retention terms.

Keep AWS keys and weather keys out of the client, source control, native build settings and `mobile/config/environment.json`. Start with deterministic recommendation rules and user feedback. An LLM is unnecessary for weather thresholds and would add cost, latency and additional data-sharing concerns.

## Deliberate scope and next iterations

This is a working mobile foundation, not an App Store submission. It includes local preferences, sample exploration, live API integration code and an undeployed AWS scaffold. It does not include cloud account flows, notification scheduling, real wardrobe inventory, purchases, product catalogs, radar rendering, or background weather monitoring.

Next product decisions:

1. Confirm the name, icon, palette, legal entity, support contact and production identifiers.
2. Test with real weather and target users. Refine comfort thresholds, rain/wind combinations and garment suitability before adding more screens.
3. Decide whether saved outfits genuinely need accounts and cross-device sync. If so, implement authentication, authorization, migration, export/deletion and recovery end to end before enabling signup.
4. Add accessibility/native-device regression tests, signed development builds, TestFlight review and store assets. Review current App Store requirements when preparing release.

## Existing deployment boundaries

The Vite web client and legacy `/api` endpoints are preserved. They are not included in the Lambda bundle. Existing file-backed accounts, the legacy JWT development fallback, unrestricted legacy CORS, and the old retailer-preview fetching path need a separate production security review before exposing them to a larger mobile audience. Never deploy the legacy server with a missing/weak `JWT_SECRET`; do not migrate password hashes or tracked user data without an explicit, reviewed plan.

## References

- [React Native environment setup](https://reactnative.dev/docs/0.86/set-up-your-environment)
- [React Native iOS distribution](https://reactnative.dev/docs/0.86/publishing-to-app-store)
- [Apple: prepare for app distribution](https://help.apple.com/xcode/mac/current/en.lproj/dev91fe7130a.html)
- [Local Xcode release checklist](MOBILE_RELEASE.md)
- [AWS migration and security details](AWS_MOBILE.md)
