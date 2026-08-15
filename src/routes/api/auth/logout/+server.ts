import { clearSessionCookie, readSessionCookie } from '$lib/server/auth/cookie';
import { getAuthService } from '$lib/server/auth/runtime';
import { getConfig } from '$lib/server/config';
import { apiErrorResponse } from '$lib/server/http/api-error';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies, locals, request }) => {
  let appOrigin: string;
  try {
    appOrigin = getConfig().appBaseUrl.origin;
  } catch {
    return apiErrorResponse(500, 'INTERNAL_ERROR', 'Unable to complete logout.', locals.requestId);
  }

  if (request.headers.get('origin') !== appOrigin) {
    return apiErrorResponse(
      403,
      'REQUEST_ORIGIN_INVALID',
      'Request origin is not allowed.',
      locals.requestId
    );
  }

  const token = readSessionCookie(cookies);
  try {
    getAuthService().endSession(token);
  } catch {
    clearSessionCookie(cookies);
    return apiErrorResponse(500, 'INTERNAL_ERROR', 'Unable to complete logout.', locals.requestId);
  }

  clearSessionCookie(cookies);
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
};
