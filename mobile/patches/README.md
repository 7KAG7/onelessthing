# Geolocation 3.4.0 compatibility patch

`@react-native-community+geolocation+3.4.0.patch` is applied by `patch-package` after installation. It is intentionally limited to:

- Correcting the TurboModule background-update option from `string` to `boolean`, matching the public API
- Reading that option in the legacy iOS converter so explicit `false` is preserved
- Stopping iOS one-shot location collection after an error clears pending requests and their timers, while preserving active observers
- Adapting the three iOS struct-argument entry points to the generated New Architecture reference signatures, then reusing the original option conversion and implementation. The legacy branches remain intact

The app explicitly sets When In Use authorization, disables background updates and requests a low-accuracy one-shot position only after a tap. Android requests only coarse permission. Coordinates are rounded before they leave the location helper. Removing the background option from the public API call is not equivalent to `false`: this package's JavaScript wrapper substitutes `true` when omitted.

`npm test` checks the installed patch, generated iOS signatures and JavaScript permission/cancellation behavior. These checks do not compile or run Objective-C++. Xcode simulator/device validation remains required, including first permission, denial, repeated use, approximate accuracy, timeout, native errors and dismissal. Revisit/remove this patch when upgrading the geolocation package to an upstream version that contains these fixes.
