import { json } from '@sveltejs/kit';
import type { ApiErrorCode, ApiErrorEnvelope } from '$lib/types/api';

export function apiErrorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId: string,
  headers: HeadersInit = {}
): Response {
  const body: ApiErrorEnvelope = {
    error: {
      code,
      message,
      fieldErrors: {},
      requestId
    }
  };

  return json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      ...Object.fromEntries(new Headers(headers))
    }
  });
}
