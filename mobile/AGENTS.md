# Mobile development guidance

This is a bare React Native application with checked-in iOS and Android projects. Preserve the working Vite website and versioned backend contract while changing the native client.

## Toolchain and commands

- Use the Node.js version in the repository's `.nvmrc` and npm lockfiles. Check `mobile/package.json` before changing React Native or native dependency versions.
- Read the matching [React Native documentation](https://reactnative.dev/docs/0.86/getting-started) and each native library's official compatibility instructions before changing native APIs.
- Install JavaScript dependencies with `npm ci` from `mobile/`.
- Start Metro with `npm start`. Build and run the iOS application on a Mac with Xcode; build Android with its checked-in Gradle project and Android tooling.
- After changing native dependencies on a Mac, run `bundle install` from `mobile/`, then `bundle exec pod install` from `mobile/ios/`. Review the native project and dependency-lock changes.
- Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run check` before declaring changes verified. These checks cannot establish that Xcode compilation, signing or native UI works.

## Native projects and navigation

- Maintain `ios/` and `android/` as source. Do not replace or regenerate them casually; preserve identifiers, capabilities, permissions and build phases.
- The iOS project is `ios/OneLessThing.xcodeproj`. After CocoaPods installation, open `ios/OneLessThing.xcworkspace` to build with the native dependencies.
- Use React Navigation for tab and stack navigation. Keep reusable UI, network access, native location access and state logic separate from screen components.
- Preserve native Back and gesture dismissal. Test repeated modal opens, cancellation, app resume, permission denial and interrupted network requests.
- Keep device location opt-in, foreground-only and optional; manual city search must remain available.

## Configuration and security

- Public API configuration lives in `config/environment.json` and is exposed to TypeScript by `src/config.ts`. Never put weather-provider keys, AWS credentials, signing material or authentication secrets in the client or native project.
- Preserve explicit sample labels and runtime response/URL validation. A failed live request must never silently become sample weather.
- Preferences and saved outfits are device-local. Do not imply account authentication or cloud synchronization exists until implemented and tested end to end.
- Signing, new credentials, external deployment, account setup and store submission require the owner's applicable authorization. Never commit certificates, private keys, provisioning profiles or machine-local settings.

## Verification boundaries

Use a Mac for Xcode compilation, CocoaPods integration, Simulator/device checks and release archives. Linux JavaScript checks or bundles do not prove an iOS native build or App Store readiness. Record exactly which checks passed, failed or were not run, following `../docs/VERIFICATION.md` and `../docs/MOBILE_RELEASE.md`.
