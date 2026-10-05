import { MobileErrorCode, MobileErrorResponse } from './contracts';

export class MobileApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: MobileErrorCode,
    message: string,
    public readonly retryable = false
  ) {
    super(message);
    this.name = 'MobileApiError';
  }
}

/** Never return raw upstream errors, URLs, credentials, or stack traces. */
export function toErrorResponse(error: unknown): { status: number; body: MobileErrorResponse } {
  const safe = error instanceof MobileApiError
    ? error
    : new MobileApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.', true);
  return {
    status: safe.status,
    body: { apiVersion: '1', error: { code: safe.code, message: safe.message, retryable: safe.retryable } }
  };
}
