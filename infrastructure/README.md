# AWS mobile foundation

This is an **undeployed scaffold**, separate from the live Lightsail website.

Read [the AWS/mobile guide](../docs/AWS_MOBILE.md) for implemented behavior, migration, auth, privacy, costs, and release gates.

## Local checks

Use Node.js 24, then from the repository root:

```bash
npm --prefix infrastructure ci
npm --prefix infrastructure run check
```

The check bundles the shared `src/mobile` API with its AWS adapter, type-checks it, and runs offline tests. It does not retrieve secrets, make weather requests, create AWS resources, or exercise a live identity provider.

If AWS SAM CLI is installed:

```bash
sam validate --lint --template-file infrastructure/template.yaml
```

With Docker and SAM installed, the health event needs no secret:

```bash
sam local invoke MobileApiFunction \
  --template infrastructure/template.yaml \
  --event infrastructure/events/health.json
```

Build output is `infrastructure/.build/`. The SAM template points to this prebundled directory; `npm run build` is the build step. No whole-repository archive, `.env`, `data/users.json`, or legacy server is packaged. Do not deploy stale build output.

There is deliberately no automatic deployment script or checked-in AWS configuration. Provisioning and its costs require a separate explicit decision.

## Validation performed

On 2026-10-04: TypeScript checks, the production bundle, all 18 offline tests, and a direct invocation of the packaged health handler passed. `cfn-lint 1.57.1` validated the SAM template without errors or warnings. SAM CLI/Docker invocation and AWS deployment/integration were not run.
