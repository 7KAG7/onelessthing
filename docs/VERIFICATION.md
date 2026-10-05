# Foundation verification

## Observed local results (2026-10-05)

A fresh `npm ci` applied the tracked native geolocation patch successfully. The final local aggregate check passed: 19 API tests, 32 mobile tests and 18 infrastructure tests (69 total); TypeScript; ESLint; the existing server/Vite builds; iOS and Android Metro bundles; and the Lambda bundle. The mobile dependency lock contains no framework/cloud-build runtime packages from the previous workflow. iOS plist/icon references and the native release wrapper's shell syntax were checked.

The PR workflow also defines an unsigned iOS simulator compilation on a Mac runner. This is a future remote check until that workflow runs successfully for the published commit; it is not a local Xcode build result. The initial native privacy manifest declares coarse location for app functionality and still needs owner/privacy review before distribution.

## Automated verification commands

Use Node.js 24. Install root, client, mobile and infrastructure dependencies, then run `npm run check` from the repository root. The aggregate check covers:

- Existing server TypeScript check and production build
- Deterministic versioned mobile API unit/HTTP tests
- Existing Vite website production build
- Mobile TypeScript check and ESLint
- Mobile domain/contract/formatting and component-state tests
- React Native JavaScript bundles for iOS and Android
- Infrastructure TypeScript check, bundled Lambda and offline handler/template tests

These are executable checks, not proof of native-device or production behavior. Record their results against the exact final commit before treating a change as verified.

To run the mobile checks separately:

```sh
cd mobile
npm ci
npm run typecheck
npm run lint
npm test
npm run bundle:ios
npm run bundle:android
# Aggregate mobile check:
npm run check
# Requires an approved live HTTPS API origin; sample configuration fails intentionally:
npm run check:release-config
```

The JavaScript bundles exercise Metro's resolution and transformation for both native platforms. They do **not** compile the native projects, run CocoaPods/Gradle, produce a signed application, or prove device behavior. The Xcode Release bundle phase also invokes the API configuration gate, but that native build-phase integration must be exercised on a Mac.

The state tests use React Test Renderer with native storage/AppState adapters mocked. They cover state transitions, not pixels, native controls or OS permissions. Any React Test Renderer deprecation message and the existing Vite CJS API deprecation warning should be distinguished from test failures.

Infrastructure validation remains independent:

```sh
npm --prefix infrastructure run check
# With AWS SAM CLI installed:
sam validate --lint --template-file infrastructure/template.yaml
# CloudFormation lint, when installed:
cfn-lint infrastructure/template.yaml
```

SAM/CloudFormation lint and offline tests do not verify an AWS deployment or real weather-provider integration.

## Mac/native checks still required

Follow [the mobile setup guide](../mobile/README.md#ios-development-on-a-mac) and [release checklist](MOBILE_RELEASE.md). The current Linux environment does not provide Xcode or Ruby/CocoaPods, so it has not verified:

- CocoaPods installation and the resolved iOS dependency workspace/lockfile
- Xcode project compilation, Simulator launch or native module integration
- Physical iOS/Android layout, accessibility, native Back/gesture handling, permission dialogs, keyboard behavior and foreground/background transitions
- Android Gradle compilation, release signing or app-bundle generation
- Xcode Release build, archive creation, signing, archive validation or embedded-bundle launch with Metro stopped
- TestFlight distribution or App Store submission

## Service and publication checks still required

- Real weather-provider calls with approved staging/production credentials
- Actual Lambda, Cognito, DynamoDB or Secrets Manager integration in an AWS account
- SAM CLI/Docker build and local-invoke checks, unless recorded separately after running them
- Remote CI for the exact published commit
- Browser QA of the preserved Vite website after any relevant web changes; browser output does not validate the native app

No AWS deployment, production changes, new credentials, paid service builds or store submission were performed. Completing JavaScript and offline infrastructure checks does not make this an App Store-ready release.
