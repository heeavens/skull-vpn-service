import { setSessionCookie } from '$lib/server/auth/cookie';
import { AuthRateLimitError, type RateLimitDecision } from '$lib/server/auth/rate-limit';
import { getAuthAttemptRateLimiter, getAuthService } from '$lib/server/auth/runtime';
import {
  readBoundedUtf8Body,
  RequestBodyTooLargeError,
  TELEGRAM_INIT_DATA_BODY_MAX_BYTES
} from '$lib/server/http/body';
import { apiErrorResponse } from '$lib/server/http/api-error';
import { TelegramInitDataError } from '$lib/server/telegram/init-data';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, getClientAddress, locals, request }) => {
  let attemptDecision: RateLimitDecision;
  try {
    attemptDecision = getAuthAttemptRateLimiter().consume(getClientAddress(), new Date());
  } catch {
    return apiErrorResponse(
      500,
      'INTERNAL_ERROR',
      'Unable to complete authentication.',
      locals.requestId
    );
  }

  if (!attemptDecision.allowed) {
    return apiErrorResponse(
      429,
      'AUTH_RATE_LIMITED',
      'Too many authentication attempts. Try again later.',
      locals.requestId,
      { 'retry-after': String(attemptDecision.retryAfterSeconds) }
    );
  }

  if (!isPlainText(request.headers.get('content-type'))) {
    return apiErrorResponse(
      415,
      'REQUEST_CONTENT_TYPE_INVALID',
      'Content-Type must be text/plain.',
      locals.requestId
    );
  }

  let rawInitData: string;
  try {
    rawInitData = await readBoundedUtf8Body(request, TELEGRAM_INIT_DATA_BODY_MAX_BYTES);
  } catch (error: unknown) {
    if (error instanceof RequestBodyTooLargeError) {
      return apiErrorResponse(
        413,
        'REQUEST_BODY_TOO_LARGE',
        'Authentication data is too large.',
        locals.requestId
      );
    }

    return apiErrorResponse(
      401,
      'TELEGRAM_INIT_DATA_INVALID',
      'Telegram authentication data is invalid.',
      locals.requestId
    );
  }

  try {
    const authService = getAuthService();
    const session = authService.authenticateWithTelegram(rawInitData);
    try {
      setSessionCookie(cookies, session);
    } catch {
      authService.endSession(session.token);
      throw new Error('Session cookie could not be set');
    }
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  } catch (error: unknown) {
    if (error instanceof TelegramInitDataError) {
      const expired = error.reason === 'EXPIRED';
      return apiErrorResponse(
        401,
        expired ? 'TELEGRAM_INIT_DATA_EXPIRED' : 'TELEGRAM_INIT_DATA_INVALID',
        expired
          ? 'Telegram authentication data has expired.'
          : 'Telegram authentication data is invalid.',
        locals.requestId
      );
    }

    if (error instanceof AuthRateLimitError) {
      return apiErrorResponse(
        429,
        'AUTH_RATE_LIMITED',
        'Too many authentication attempts. Try again later.',
        locals.requestId,
        { 'retry-after': String(error.retryAfterSeconds) }
      );
    }

    return apiErrorResponse(
      500,
      'INTERNAL_ERROR',
      'Unable to complete authentication.',
      locals.requestId
    );
  }
};

function isPlainText(contentType: string | null): boolean {
  return contentType?.split(';', 1)[0]?.trim().toLowerCase() === 'text/plain';
}
