# Mobile release checklist

This checklist is a release gate, not a claim that these checks have passed. iOS distribution uses the checked-in native project and Xcode on a Mac. Xcode compilation, CocoaPods integration, native-device testing, signing and archive validation have not been verified in the Linux environment.

## Product and service setup

- [ ] Confirm production application name, app icon, bundle ID/package, legal owner and support contact.
- [ ] Confirm the Apple Developer team, authorized account access and App Store Connect app record. Signing material must remain outside source control.
- [ ] Deploy and verify a staging backend after AWS/Lightsail deployment approval. Confirm provider keys, commercial license/attribution requirements and quotas.
- [ ] Set `apiBaseUrl` in `mobile/config/environment.json` to the approved production HTTPS origin and run `npm --prefix mobile run check:release-config`. An empty sample-mode configuration intentionally fails this gate.
- [ ] Supply an approved production privacy policy and public support URL. Complete accurate App Store privacy disclosures for location, provider requests and any analytics actually used.
- [ ] Ensure weather credentials never appear in a JavaScript bundle, app config, native build settings, logs or source control.
- [ ] Review legacy auth, file-backed user storage, JWT configuration and the retailer preview path before widening legacy server exposure.
- [ ] Confirm public API abuse controls, request throttles, cost alarms, logging redaction and service availability monitoring.

## Native device verification

- [ ] Install JavaScript/Ruby/CocoaPods dependencies on a Mac and build `mobile/ios/OneLessThing.xcworkspace` successfully in Xcode. Record the Xcode, SDK, Ruby and CocoaPods versions used.
- [ ] Launch cleanly on supported physical iPhones and Android devices, including small screens and any tablet targets retained for release.
- [ ] Verify safe areas, large text, VoiceOver/TalkBack labels, focus order, keyboard avoidance and platform-appropriate touch targets.
- [ ] Test search typing rapidly, changing location twice, closing/reopening the modal during lookup, and native Back/gesture dismissal.
- [ ] Test location allow-once, denial, unavailable location, reduced accuracy, permission changes in Settings and request timeout. Verify city fallback.
- [ ] Confirm location is requested only by a tap and no background permission or tracking occurs.
- [ ] Test live current weather and hourly forecast against actual staging credentials. Verify city disambiguation, zero/negative coordinates and location-local hours.
- [ ] Test current-weather failure, forecast-only failure, lost network, timeout, refresh with old data, and reconnect.
- [ ] Change comfort/style repeatedly while a request is pending; verify the last choice wins.
- [ ] Save an outfit twice, switch tabs, restart, view/remove saved outfits, and simulate full/corrupt device storage.
- [ ] Verify affiliate searches and disclosures on both platforms; cancel browser navigation and return to the app.
- [ ] Test repeated navigation, modal dismissal, app suspension and resume after several hours. Test native links if introduced for release.
- [ ] Confirm the Xcode Release bundle phase rejects an unset/insecure API origin and release testing never falls back to sample weather.
- [ ] Run a Release build on a real iPhone with Metro stopped, confirming the embedded JavaScript/assets load and live weather works.

## Xcode archive, signing and App Store Connect

Prepare the local build using [mobile/README.md](../mobile/README.md#ios-development-on-a-mac). The `.xcodeproj` contains the app target; CocoaPods creates or updates the `.xcworkspace` used for builds.

1. Open `mobile/ios/OneLessThing.xcworkspace`. Select the `OneLessThing` target and confirm the approved bundle identifier, version, build number, app icons, supported devices and location usage description. In **Signing & Capabilities**, select the owner's authorized Apple Developer team. Resolve signing locally using the approved automatic or manual signing arrangement. Do not commit certificates, private keys or provisioning profiles. See [Apple's distribution preparation](https://help.apple.com/xcode/mac/current/en.lproj/dev91fe7130a.html).
2. Run the repository checks against the final commit. Review **Product → Scheme → Edit Scheme → Archive** and confirm the build configuration is **Release**. Inspect the `Bundle React Native code and images` build phase and the API release gate; do not bypass them to produce an archive. Release builds must contain the JavaScript bundle and assets. See [React Native's iOS distribution guide](https://reactnative.dev/docs/0.86/publishing-to-app-store).
3. Select a generic iOS device destination, such as **Any iOS Device (arm64)**, or a physical device rather than a simulator. Choose **Product → Archive**. In **Window → Organizer → Archives**, inspect the resulting app archive and resolve validation errors. This follows [Apple's archive workflow](https://help.apple.com/xcode/mac/current/en.lproj/devf37a1db04.html).
4. After upload authorization, choose **Distribute App → App Store Connect** in Organizer and follow Xcode's validation/signing/upload steps. Check the app record and exact version/build in App Store Connect after processing; an upload alone does not establish a successful store release. Apple's [build upload instructions](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/) document the current accepted tooling and role requirements.
5. Configure authorized TestFlight testing, resolve feedback and complete the checklist above. Prepare reviewed screenshots, description, age rating, privacy answers, encryption/export-compliance answers and review notes for the actual app. Obtain separate approval before App Review submission or rollout.

Recheck Apple's current SDK/tool requirements when preparing distribution. Xcode interface labels can vary by version. No signed build, account registration, credential generation, upload, TestFlight distribution or App Review submission has been performed by adding this foundation.

## Accounts, only if enabled later

- [ ] Implement Cognito authorization-code PKCE, refresh, expiry, cancellation, logout and secure device token storage.
- [ ] Derive all data ownership from verified JWT subject, never client user IDs. Test cross-user access denial.
- [ ] Implement conflict handling, idempotent writes, offline sync and import of local saved outfits.
- [ ] Provide in-app account deletion and the required export/recovery/privacy process before offering signup.
- [ ] Complete migration planning for legacy users without silently copying passwords or profiles.

## Final distribution gates

- [ ] Run repository/backend checks, mobile checks, AWS handler tests and infrastructure validation against the final commit.
- [ ] Resolve all Xcode signing/archive validation warnings that affect distribution and retain the tested archive/build identity.
- [ ] Verify current Apple/Google submission policies and build-tool requirements using official docs.
- [ ] If shipping Android, complete the separate native Gradle signing, app-bundle and Play Console workflow; iOS archive success does not verify Android.
- [ ] Obtain explicit approval before store submission, rollout, production deployment or paid service commitments.
