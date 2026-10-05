import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { createMobileApi, toErrorResponse } from '../../src/mobile/api';

const SECRET_TTL_MS = 5 * 60 * 1000;
const PRIVATE_SCOPE = 'onelessthing/user';
const secrets = new SecretsManagerClient({ maxAttempts: 2 });

/** Dependency injection keeps local tests entirely offline and credential-free. */
export function createSecretLoader(options: {
  secretArn: string;
  readSecret: (secretArn: string) => Promise<string | undefined>;
  now?: () => number;
}) {
  let cached: { key: string; expires: number } | undefined;
  let pending: Promise<string> | undefined;
  const now = options.now ?? Date.now;
  return async () => {
    if (cached && cached.expires > now()) return cached.key;
    if (!options.secretArn) throw new Error('Weather secret is not configured');
    if (!pending) {
      pending = (async () => {
        const value = await options.readSecret(options.secretArn);
        // Deliberately support one documented JSON shape, never log the value.
        const key: unknown = JSON.parse(value ?? '{}').OPENWEATHER_API_KEY;
        if (typeof key !== 'string' || !key.trim() || key.length > 512) {
          throw new Error('Weather secret has an invalid shape');
        }
        cached = { key: key.trim(), expires: now() + SECRET_TTL_MS };
        return cached.key;
      })();
    }
    try {
      return await pending;
    } finally {
      pending = undefined;
    }
  };
}

type MobileApi = ReturnType<typeof createMobileApi>;
type HandlerOptions = {
  loadApiKey: () => Promise<string>;
  apiFactory?: (apiKey: string) => Pick<MobileApi, 'outfit' | 'locations'>;
};

function response(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
    body: JSON.stringify(body),
  };
}

function error(status: number, code: string, message: string, retryable = false) {
  return response(status, { apiVersion: '1', error: { code, message, retryable } });
}

export function createHandler(options: HandlerOptions) {
  let api: Pick<MobileApi, 'outfit' | 'locations'> | undefined;
  let previousKey: string | undefined;
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const path = event.rawPath;
    const method = event.requestContext?.http?.method;
    if (method === 'GET' && path === '/api/v1/health') {
      return response(200, { apiVersion: '1', status: 'ok', cloudSync: false });
    }

    if (path === '/api/v1/me' || path === '/api/v1/saved-outfits' || /^\/api\/v1\/saved-outfits\/[^/]+$/.test(path)) {
      // Signature/issuer/audience validation is API Gateway's responsibility.
      // Never accept user IDs from headers, query strings, bodies, or decoded JWTs.
      const auth = (event.requestContext as APIGatewayProxyEventV2['requestContext'] & {
        authorizer?: { jwt?: { claims?: Record<string, unknown>; scopes?: string[] } };
      }).authorizer?.jwt;
      const claims = auth?.claims;
      if (typeof claims?.sub !== 'string' || !claims.sub || claims.token_use !== 'access' || !auth?.scopes?.includes(PRIVATE_SCOPE)) {
        return error(401, 'UNAUTHORIZED', 'A valid Cognito access token is required.');
      }
      return error(501, 'CLOUD_SYNC_NOT_IMPLEMENTED', 'Cloud profiles and saved outfits are not available yet.');
    }

    if (method !== 'GET' || (path !== '/api/v1/outfit' && path !== '/api/v1/locations')) {
      return error(404, 'NOT_FOUND', 'This API route does not exist.');
    }

    // Avoid reading secrets or contacting providers for a repeated query key.
    const query: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(event.rawQueryString ?? '')) {
      if (Object.hasOwn(query, key)) return error(400, 'INVALID_QUERY', 'Query parameters must not be repeated.');
      Object.defineProperty(query, key, { value, enumerable: true, configurable: true });
    }

    let key: string;
    try {
      key = await options.loadApiKey();
    } catch {
      // Never expose secret identifiers, SDK errors, tokens, or key material.
      return error(503, 'SERVICE_UNAVAILABLE', 'Weather is temporarily unavailable. Please try again.', true);
    }
    try {
      if (!api || key !== previousKey) {
        api = options.apiFactory?.(key) ?? createMobileApi({
          apiKey: key,
          affiliateTag: process.env.AMAZON_ASSOCIATE_TAG ?? '',
          timeoutMs: 6500,
        });
        previousKey = key;
      }
      return response(200, path === '/api/v1/outfit' ? await api.outfit(query) : await api.locations(query));
    } catch (cause) {
      const failure = toErrorResponse(cause);
      return response(failure.status, failure.body);
    }
  };
}

export const handler = createHandler({
  loadApiKey: createSecretLoader({
    secretArn: process.env.WEATHER_SECRET_ARN ?? '',
    readSecret: async (secretArn) => {
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), 4000);
      try {
        const value = await secrets.send(new GetSecretValueCommand({ SecretId: secretArn }), { abortSignal: controller.signal });
        return value.SecretString;
      } finally {
        clearTimeout(deadline);
      }
    },
  }),
});
