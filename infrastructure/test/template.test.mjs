import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';

// These assertions are regression guards, not a replacement for sam validate --lint.
const customTags = [
  ...['!Ref', '!GetAtt', '!Sub'].map((tag) => ({ tag, resolve: (value) => value })),
  ...['!If', '!Equals', '!Not'].map((tag) => ({ tag, collection: 'seq', resolve: (seq) => seq.toJSON() })),
];
const template = parse(readFileSync(new URL('../template.yaml', import.meta.url), 'utf8'), { customTags });
const resources = template.Resources;

test('native client has no secret and uses only authorization-code OAuth', () => {
  const client = resources.MobileUserPoolClient.Properties;
  assert.equal(client.GenerateSecret, false);
  assert.deepEqual(client.AllowedOAuthFlows, ['code']);
  assert.equal(client.EnableTokenRevocation, true);
  assert.deepEqual(client.ExplicitAuthFlows, ['ALLOW_REFRESH_TOKEN_AUTH']);
});

test('Cognito auth defaults to custom scope and only the three read-only public routes opt out', () => {
  const auth = resources.MobileHttpApi.Properties.Auth;
  assert.equal(auth.DefaultAuthorizer, 'CognitoJwt');
  assert.deepEqual(auth.Authorizers.CognitoJwt.AuthorizationScopes, ['onelessthing/user']);
  const exposed = Object.values(resources.MobileApiFunction.Properties.Events)
    .filter(({ Properties }) => Properties.Auth?.Authorizer === 'NONE')
    .map(({ Properties }) => `${Properties.Method} ${Properties.Path}`).sort();
  assert.deepEqual(exposed, ['GET /api/v1/health', 'GET /api/v1/locations', 'GET /api/v1/outfit']);
  assert.equal(resources.MobileApiFunction.Properties.FunctionUrlConfig, undefined);
});

test('runtime and deployment artifact do not include the legacy Express server', () => {
  const fn = resources.MobileApiFunction.Properties;
  assert.equal(fn.Runtime, 'nodejs24.x');
  assert.equal(fn.CodeUri, '.build/');
  assert.equal(fn.Handler, 'handler.handler');
  assert.equal(fn.Environment.Variables.OPENWEATHER_API_KEY, undefined);
  assert.equal(fn.Environment.Variables.JWT_SECRET, undefined);
});

test('profile/outfit data have retained storage and no premature database access', () => {
  for (const name of ['ProfilesTable', 'SavedOutfitsTable']) {
    assert.equal(resources[name].DeletionPolicy, 'Retain');
    assert.equal(resources[name].UpdateReplacePolicy, 'Retain');
    assert.equal(resources[name].Properties.BillingMode, 'PAY_PER_REQUEST');
  }
  const policies = JSON.stringify(resources.MobileFunctionRole.Properties.Policies);
  assert.doesNotMatch(policies, /dynamodb:|secretsmanager:\*|AdministratorAccess|"Resource":"\*"/);
  assert.match(policies, /secretsmanager:GetSecretValue/);
});

test('logging avoids user location and auth data, with explicit retention and throttles', () => {
  for (const name of ['ApiLogs', 'FunctionLogs']) assert.equal(resources[name].Properties.RetentionInDays, 14);
  assert.doesNotMatch(resources.MobileHttpApi.Properties.AccessLogSettings.Format, /sourceIp|query|claims|authorization|body|userAgent/i);
  assert.ok(resources.MobileHttpApi.Properties.DefaultRouteSettings.ThrottlingRateLimit <= 5);
  assert.equal(resources.MobileApiFunction.Properties.ReservedConcurrentExecutions, 5);
  assert.notEqual(resources.MobileHttpApi.Properties.CorsConfiguration.AllowOrigins[0], '*');
});
