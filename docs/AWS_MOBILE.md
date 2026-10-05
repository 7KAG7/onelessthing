# One Less Thing: AWS mobile backend

## Status and boundaries

The existing website stays on Lightsail, nginx, and PM2 as described in [DEPLOY_AWS.md](../DEPLOY_AWS.md). This foundation introduces an independent AWS serverless destination for the native mobile app. **No stack has been deployed, credentials created, production data migrated, or DNS changed.**

Implemented locally:

- A Node.js 24 Lambda adapter for the same portable `src/mobile/api.ts` service used by the new Express `/api/v1` routes
- An AWS SAM template for an HTTP API, Cognito user pool and public mobile client, DynamoDB profile and saved-outfit tables, restricted Lambda role, and bounded CloudWatch log retention
- Runtime loading of one existing weather-provider secret, short in-memory secret caching, safe response errors, and offline regression tests

Not implemented or verified in AWS:

- Mobile Cognito login, logout, token refresh/revocation, account deletion, or identity migration
- Profile or saved-outfit synchronization, DynamoDB reads/writes, data export, or cross-device state
- Deployment, device-to-AWS integration, production alarms, load testing, or an App Store-ready privacy/compliance review

The mobile client can keep preferences and saved outfits on the device for this first iteration. It must label that storage honestly and never show successful cloud sync. Cloud routes return `501 CLOUD_SYNC_NOT_IMPLEMENTED` after authentication. The template creates the future tables but **grants the Lambda no DynamoDB permissions** until real persistence is implemented and tested.

## Architecture and routes

Native React Native app → HTTPS API Gateway HTTP API → Lambda → weather providers.

Future authenticated flows: native app → Cognito authorization-code login with PKCE → access token → HTTP API JWT authorizer → owner-scoped Lambda → DynamoDB.

The Lambda does not import Express, start a listener, read `data/users.json`, use the web JWT secret, or serve static files. Its build bundles the weather service and AWS SDK into `.build/handler.js`.

Public routes:

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/api/v1/health` | Liveness only; returns `cloudSync: false`; does not probe the weather provider or secret |
| GET | `/api/v1/outfit` | Normalized current weather, outfit recommendations, optional forecast |
| GET | `/api/v1/locations` | Location search |

Protected placeholders are `/api/v1/me`, `/api/v1/saved-outfits`, and `/api/v1/saved-outfits/{outfitId}`. These require the Cognito app client's access token with the `onelessthing/user` scope. The adapter additionally checks the trusted authorizer's `sub`, `token_use`, and scopes. It never accepts an owner ID from request headers, query parameters, or a decoded, unverified token. Unknown routes do not fall through to the website.

See [the versioned API contract](../src/mobile/README.md) for accepted query parameters, units, and response shapes. Weather requests contain no passwords or user tokens. Query strings can contain location; infrastructure logs intentionally exclude them.

## Local build and validation

Use Node.js 24. From the repository root:

```bash
npm --prefix infrastructure ci
npm --prefix infrastructure run check
sam validate --lint --template-file infrastructure/template.yaml
```

The first two commands require no AWS account credentials. Tests inject a secret reader and weather service; they verify route isolation, auth failures, explicit sync placeholders, safe errors, key-cache expiration, and infrastructure guardrails. `sam validate --lint` additionally checks SAM/CloudFormation syntax with the installed SAM CLI. Regression assertions are not a substitute for that validation or a staging deployment.

`npm --prefix infrastructure run build` creates the prebundled `CodeUri` directory. It must be rerun after changing the service, adapter, or dependencies. The dependency lockfile pins the bundled SDK; the function does not depend on whatever SDK version happens to ship in a Lambda runtime. SAM/Docker health-invoke instructions are in [infrastructure/README.md](../infrastructure/README.md).

## Secrets and configuration

`WeatherSecretArn` must identify an **existing, same-region** AWS Secrets Manager secret. The owner creates it through an approved secure flow with this JSON shape:

```json
{ "OPENWEATHER_API_KEY": "the provider key" }
```

The key itself never belongs in template parameters, shell history, git, app configuration, native build settings, build logs, or the mobile bundle. Only the secret ARN is injected into Lambda. Retrieval permission is limited to that one ARN. The optional KMS permission is limited to an explicitly supplied key, Secrets Manager service use, and that secret's encryption context. A customer-managed key's own policy must also permit the approved execution role.

The adapter caches the secret for five minutes per warm Lambda environment, coalesces simultaneous loads, and picks up rotation after expiration. Retrieval errors are sanitized to retryable `503` responses. Expired secret values are not silently reused indefinitely. Neither successful secret reads nor raw provider errors are logged.

The API origin, AWS region, Cognito pool ID, public client ID, hosted-UI domain, and affiliate tag are configuration rather than credentials. Public client IDs are expected to be shipped in a mobile binary. Do not add an AWS access key, Cognito client secret, provider key, or web `JWT_SECRET` to the app.

## Cognito integration required before accounts launch

The template uses a public app client with `GenerateSecret: false`, only the OAuth authorization-code grant, a Cognito-hosted login domain, a custom API scope, verified email, optional authenticator-app MFA, 15-minute access/ID tokens, and a seven-day refresh token. It uses the Lite tier and classic hosted UI; newer managed-login branding and additional tiers are separate choices.

The client implementation must:

1. Open the system authentication browser with a fresh cryptographically random state, nonce, and PKCE verifier; send the S256 challenge
2. Verify state, nonce where applicable, and the exact redirect URI; exchange the code with the original verifier and no client secret
3. Send the access token in the `Authorization: Bearer …` header. ID tokens are not API credentials; the custom scope helps prevent their accidental use
4. Keep refresh tokens in platform-backed secure storage using iOS Keychain or Android Keystore-backed encryption, not AsyncStorage, URLs, logs, or analytics. Handle missing or invalidated secure-storage entries by signing in again
5. Serialize refreshes, handle expiry and revocation without retry loops, clear local credentials on sign-out, and revoke the refresh token through the supported flow
6. Support cancellation, app suspension, a cold-start redirect, repeated redirects, lost network, reinstall/restore, and account deletion. Test on real iOS devices

The `onelessthing://auth/callback` and `onelessthing://auth/signout` defaults are placeholders until registered in the native iOS and Android projects. Use distinct staging/production app identifiers, schemes, Cognito clients, pools, and exact redirect allowlists. Prefer app-claimed HTTPS links for the release if available. Do not add broad wildcard callbacks or an arbitrary redirect URL from an incoming request. Validate callbacks in a signed native build before enabling login.

API Gateway validates JWT signature, issuer, audience/client ID, expiry, and required scope. It does not make the application authorization-complete: future DynamoDB handlers must use the validated Cognito `sub` as the owner, reject cross-user record access, and enforce account deletion/disabled-account behavior. Revoking refresh tokens does not instantly invalidate an already-issued JWT accepted through offline signature checks; design account-deletion and sign-out expectations around that fact, short access-token life, or an additional server-side revocation check.

## DynamoDB implementation plan

`ProfilesTable` uses `userId` as its partition key. `SavedOutfitsTable` uses `userId` plus `outfitId`. These IDs must come from validated identity and server-owned item IDs, never client-authorized ownership claims. DynamoDB encrypts stored data by default; production enables point-in-time recovery and deletion protection. Both environments retain tables on stack deletion/replacement. **Retained tables can continue costing money and require deliberate cleanup.**

Before enabling writes:

- Implement a repository layer, strict input schemas, bounded record sizes, and explicit returned fields
- Add only the exact table-scoped `GetItem`, `PutItem`, `UpdateItem`, `Query`, and `DeleteItem` permissions needed by the implemented operations. Avoid `Scan`, `dynamodb:*`, and wildcard resources
- Use owner-keyed queries, pagination, per-user quotas, conditional updates/version numbers, and idempotent saves. Define conflict resolution for offline edits
- Add cross-user authorization tests, malformed/oversize payload tests, throttling tests, retry limits, export, and account/data deletion
- Store the minimum profile fields. Exact birth date, age, clothing measurements, and precise location history are not needed for the weather-to-outfit MVP
- Decide how deleting an account affects devices, caches, saved items, Cognito, logs, backups, and recovery. Retention/PITR recovery windows must be reflected in the privacy policy

Local file users, legacy web JWTs, local device preferences, and Cognito identities are different data models. Do not import username/password records or mark local saves as synchronized merely because these tables exist.

## Caching, throttling, and cost

The template starts with five requests/second and a burst target of ten **per route**, five reserved Lambda executions, 256 MB memory, a 25-second Lambda timeout, and DynamoDB on-demand read/write throughput targets. Confirm the account's Lambda concurrency quota can accommodate the reservation; small/new accounts may need a quota adjustment or a revised setting.

These are initial protection settings, not a traffic model or a hard spending cap. Public weather/search routes can still consume provider calls and AWS charges. API Gateway throttles are best-effort; limits on separate routes are not one shared per-user budget. Clients need bounded backoff with jitter for `429`/transient errors, search debouncing, request cancellation, and no background refresh loop.

Current caching is limited to the secret. API responses use `Cache-Control: private, no-store` to avoid shared location/preference leakage; weather responses are not cached server-side. Before broader release, define a provider-licensed weather/geocoding cache with explicit TTL, bounded entries, normalized keys, appropriate coordinate rounding, preference separation, and stale-data labels. A warm-process cache alone is fragmented across Lambda instances and cold starts. Never cache authenticated profile data globally or place user-specific responses in an unpartitioned CDN cache.

No Redis cluster, VPC NAT gateway, custom-domain distribution, or always-running server is required by this scaffold. That does not make it free: account for API requests, Lambda execution, Cognito usage, Secrets Manager storage/reads, DynamoDB, backups, logs, transfer, and weather-provider commercial licensing. Check current regional pricing for expected usage; free tiers and credits are not assumptions for the budget.

Create owner-approved AWS Budgets/cost alerts and operational alarms before exposing staging publicly. Monitor errors, p95 latency, throttles, Lambda concurrency, provider quota, and secret failures. Alerts notify; they do not automatically stop spending. Apply a realistic abuse-control plan before launch. A public API key embedded in the app would not be a secret or meaningful per-user protection, and CORS is not an authorization control.

## Staging and migration from Lightsail

1. Keep `https://onelessthing.life`, nginx, PM2, and `data/users.json` unchanged. Back up existing user data before any separately approved legacy deployment
2. Approve an AWS account/region, staging budget, exact resource plan, service terms, existing weather secret, domain prefix, and callbacks. Use a short-lived operator/CI identity; do not create or commit long-lived access keys
3. Run local checks, inspect the lockfile and bundle, and review the transformed SAM/CloudFormation change set. Creating/uploading a change set is an AWS action; it is not a local validation step
4. After explicit provisioning approval, an operator may run `sam deploy --guided --template-file infrastructure/template.yaml --stack-name onelessthing-mobile-staging --capabilities CAPABILITY_IAM --no-execute-changeset`. Supply ARNs/configuration only. Review and approve execution separately; this repository does not execute it
5. Verify health, a real secret read, both weather routes, wrong/expired JWTs, CORS, timeouts, absent query/token logging, and throttles. Confirm cloud sync still returns `501` until its implementation is approved and completed
6. Point only a development/TestFlight build at the staging API origin. Keep web traffic and DNS on Lightsail. Contract-test both the Express versioned API and Lambda against fixtures
7. Implement and test auth/persistence and a consent-aware migration plan if accounts are in scope. Offer a re-registration/reset or a separately reviewed identity-migration flow; never bulk-upload password hashes or copy legacy JWTs into Cognito casually
8. Provision a separate production stack only after its own approval and release gates. Roll out with a small test cohort, monitor the known version, and keep the previous mobile API contract available during supported-client migration

Rolling back the website and rolling back the mobile backend are separate operations. Retain the prior tested Lambda artifact and configuration; never roll back by deleting user tables. No existing DNS needs to change merely to test the new execute-api origin.

## Security, privacy, and release gates

- [ ] Confirm which functionality actually needs an account. Keep guest weather usable where practical
- [ ] Complete real-device auth and API tests, including token expiration, cancel/reopen, background/foreground, cold starts, lost connectivity, and accessibility
- [ ] Reconcile App Store privacy disclosures and the public privacy policy with exact collected/shared fields, local-only data, provider calls, location permission, analytics, retention, deletion, and support contact
- [ ] Provide manual city entry and an appropriate location-denied path. Request only location access needed for the stated purpose, with no background tracking by default
- [ ] Review third-party weather/geocoding/forecast commercial terms, attribution, affiliate disclosures, and product-image/content rights before monetized distribution
- [ ] If account creation ships, implement and test account deletion in the app, including data deletion and credential revocation. Do not submit an account flow whose only backend response is `501`
- [ ] Review every dependency and native SDK, privacy manifest requirement, secure-store behavior, iOS permissions, release config, HTTPS transport, and entitlement
- [ ] Verify that credentials, exact locations, email addresses, tokens, and request bodies are absent from bundle, monitoring, crash reports, and diagnostics
- [ ] Review IAM and changesets; test restore, deletion boundaries, rate limits, provider failure, budgets, operational alerts, and a rollback plan
- [ ] Check current Apple requirements separately before submission; this AWS guide is an engineering checklist, not App Review approval

## Official references checked for this scaffold

- [AWS Lambda supported runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html): Node.js 24 is an available runtime; recheck before deployment
- [SAM HTTP API properties](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-httpapi.html) and [SAM JWT authorizer configuration](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-property-httpapi-oauth2authorizer.html)
- [API Gateway JWT validation and scope checks](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- [Cognito PKCE authorization-code flow](https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html), [app client properties](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cognito-userpoolclient.html), and [hosted-UI domain versions](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cognito-userpooldomain.html)
- [DynamoDB table configuration](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-dynamodb-table.html)
- [HTTP API throttling semantics](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-throttling.html)
- [AWS guidance on Lambda secrets](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html) and [Lambda logging configuration](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-lambda-function-loggingconfig.html)
