import { getConfig } from '$lib/server/config';
import { openDatabase } from '$lib/server/db/client';
import { UserSessionRepository } from '$lib/server/db/repositories/user-session-repository';
import {
  AUTH_ATTEMPT_LIMIT,
  AUTH_ATTEMPT_WINDOW_MS,
  AUTH_USER_SESSION_LIMIT,
  AUTH_USER_SESSION_WINDOW_MS,
  SlidingWindowRateLimiter
} from './rate-limit';
import { AuthService } from './session';

type AuthRuntime = Readonly<{
  service: AuthService;
  attemptRateLimiter: SlidingWindowRateLimiter;
}>;

let runtime: AuthRuntime | undefined;

export function getAuthService(): AuthService {
  return getAuthRuntime().service;
}

export function getAuthAttemptRateLimiter(): SlidingWindowRateLimiter {
  return getAuthRuntime().attemptRateLimiter;
}

function getAuthRuntime(): AuthRuntime {
  if (runtime) return runtime;

  const config = getConfig();
  const database = openDatabase(config.databaseUrl);
  const sessionCreationRateLimiter = new SlidingWindowRateLimiter(
    AUTH_USER_SESSION_LIMIT,
    AUTH_USER_SESSION_WINDOW_MS
  );
  runtime = {
    service: new AuthService(new UserSessionRepository(database.db), {
      telegramBotToken: config.telegramBotToken,
      adminTelegramChatId: config.adminTelegramChatId,
      sessionCreationRateLimiter
    }),
    attemptRateLimiter: new SlidingWindowRateLimiter(AUTH_ATTEMPT_LIMIT, AUTH_ATTEMPT_WINDOW_MS)
  };

  return runtime;
}
