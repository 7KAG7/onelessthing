# One Less Thing mobile

A bare React Native 0.86.3 application for weather-aware outfit suggestions, using TypeScript and React Navigation. The existing Vite website and backend remain in this repository.

The native source projects are checked in:

- iOS: `ios/OneLessThing.xcodeproj`
- Android: `android/`

Both platforms currently use the provisional identifier `life.onelessthing.mobile` and app version `0.2.0`. The native configuration targets iOS 15.1+ and Android API 24+ (compile/target SDK 36); the React Native helper specifies Xcode 16.1 as its source minimum. These are source requirements, not a tested device-support claim or the current App Store submission requirements. Confirm the production identifier, supported-device range and Apple's current SDK/tool requirements before store setup.

iOS development, signing and release archives use Xcode on a Mac. The native iOS build and signing workflow have **not been verified on the Linux development machine**.

## iOS development on a Mac

1. Install a compatible Xcode and its Command Line Tools, an iOS Simulator runtime, Node.js 24, and Ruby/Bundler. Watchman is recommended. Follow the [React Native environment setup](https://reactnative.dev/docs/0.86/set-up-your-environment).
2. Install the JavaScript and iOS dependencies from this checkout:

   ```sh
   cd mobile
   npm ci
   bundle install
   cd ios
   bundle exec pod install
   cd ..
   open ios/OneLessThing.xcworkspace
   ```

   CocoaPods creates or updates `ios/OneLessThing.xcworkspace` and integrates the native dependencies. Build the workspace rather than opening only the `.xcodeproj`. Keep the resolved `Podfile.lock` under review when dependencies change.
3. In another terminal, run `npm start` from `mobile/` to start Metro.
4. In Xcode, choose the `OneLessThing` scheme, select an installed iPhone simulator, then choose **Product → Run**. For a physical device, select the authorized development team and resolve signing for that device first.

If Xcode cannot find Node, configure the `NODE_BINARY` path through `ios/.xcode.env` or the ignored machine-local override. Do not commit a developer-specific absolute path. Reinstall pods after adding or updating a native library.

The React Native CLI also supports `npm run ios` after the same Mac prerequisites and CocoaPods setup. Metro alone does not install or launch a native application.

## Android development

Install the JDK, Android Studio and SDK components required by the checked-in Gradle configuration, following [React Native's Android setup](https://reactnative.dev/docs/0.86/set-up-your-environment). Start an emulator or connect a development device, run `npm start` in one terminal, and `npm run android` from `mobile/` in another. Native Android compilation, signing and device checks remain separate verification steps.

## Sample mode and live weather

With `apiBaseUrl` empty in `config/environment.json`, development builds show an explicitly labeled sample preview for Boston, Seattle and Austin. This data is illustrative, not a live forecast. Sample mode makes no weather-provider requests and never requests device location permission.

To use live weather:

1. Start the backend from the repository root with `OPENWEATHER_API_KEY` configured and `npm run dev`, or use an approved staging deployment. The routes are `/api/v1/outfit` and `/api/v1/locations`.
2. Set `apiBaseUrl` in `mobile/config/environment.json` to the reachable API origin, without `/api/v1`. Use an HTTPS staging origin for device and release testing. A physical phone's `localhost` points to the phone, not your development computer; Android Emulator commonly reaches the host through `10.0.2.2`. Any local HTTP access also depends on the native platform's network security configuration.
3. Reload the app after editing configuration and rebuild before release. Choose a city or explicitly request device location.

Only the API origin is public. Never place weather keys, AWS credentials, client secrets or tokens in this config or the native build settings. The Xcode Release bundle phase runs `scripts/validate-release-config.cjs` and rejects an empty or non-HTTPS origin, embedded credentials, query strings and fragments. Run `npm run check:release-config` to inspect that gate locally; it intentionally fails while sample mode is configured. Confirm the origin actually serves the approved API before creating a release archive.

Device location is requested only after a tap. Coordinates are rounded to two decimal places before sending; denied permission must leave city search usable. The API sends city/coordinates to OpenWeather and coordinates to Open-Meteo. Failed live requests do not silently substitute sample weather.

## Implemented scope

- Native tab/stack navigation, including modal city search and privacy information
- Current weather, rule-based outfit pieces and reasons, hourly forecast
- Cancellable city searches, network timeout/error handling and pull-to-refresh
- Device-local comfort, clothing-search and unit preferences
- Device-local saved outfit snapshots, duplicate protection and expand/remove flow
- Explicit sample, historical-data, affiliate and provider disclosures
- Runtime API/URL validation, deterministic domain tests and component-state tests

Authentication and cloud sync are not implemented. Saved outfits stay on the device; uninstalling or clearing app storage can remove them. Branding assets and native identifiers are provisional until the owner approves them for distribution.

## Local checks

```sh
npm run typecheck
npm run lint
npm test
npm run bundle:ios
npm run bundle:android
# Typecheck, lint, tests and both JavaScript bundles:
npm run check
```

Tests compile to ignored `.test-dist/`. They cover domain/state behavior with mocked native adapters, not device UI or operating-system permissions. See [verification scope](../docs/VERIFICATION.md) for the actual checks and remaining gaps.

## Xcode release path

Complete the [release checklist](../docs/MOBILE_RELEASE.md). The intended iOS path is local dependency installation → device testing → Release archive in Xcode → archive validation → authorized upload to App Store Connect → TestFlight testing → separately approved App Review submission.

The owner must confirm the app's bundle identifier, legal owner, signing team and store metadata. Never commit signing credentials or provisioning material. No signed build, App Store upload or production deployment is claimed here.

See [product/design recommendations](../docs/MOBILE_PRODUCT.md) and [AWS architecture](../docs/AWS_MOBILE.md).

No signing keys are checked in. Android Gradle generates its standard debug key locally when needed. Release signing is deliberately unconfigured; the owner must supply their production signing setup before Android distribution.
