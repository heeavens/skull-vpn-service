import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '$lib/types/auth';
import type { UserSessionStore } from '$lib/server/db/repositories/user-session-repository';
import { verifyTelegramInitData } from '$lib/server/telegram/init-data';
import { AuthRateLimitError, type SessionCreationRateLimiter } from './rate-limit';

export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

export type AuthenticatedSession = Readonly<{
  token: string;
  expiresAt: Date;
  user: AuthenticatedUser;
}>;

type AuthServiceOptions = Readonly<{
  telegramBotToken: string;
  adminTelegramChatId: string;
  now?: () => Date;
  createToken?: () => string;
  sessionCreationRateLimiter?: SessionCreationRateLimiter;
}>;

export class AuthService {
  private readonly now: () => Date;
  private readonly createToken: () => string;

  constructor(
    private readonly repository: UserSessionStore,
    private readonly options: AuthServiceOptions
  ) {
    this.now = options.now ?? (() => new Date());
    this.createToken = options.createToken ?? (() => randomBytes(32).toString('base64url'));
  }

  authenticateWithTelegram(rawInitData: string): AuthenticatedSession {
    const now = this.now();
    const telegramUser = verifyTelegramInitData(rawInitData, this.options.telegramBotToken, now);
    const rateLimitDecision = this.options.sessionCreationRateLimiter?.check(
      telegramUser.telegramUserId,
      now
    );
    if (rateLimitDecision && !rateLimitDecision.allowed) {
      throw new AuthRateLimitError(rateLimitDecision.retryAfterSeconds);
    }

    const token = this.createToken();
    if (!isOpaqueSessionToken(token)) {
      throw new Error('Session token generator returned an invalid token');
    }

    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_SECONDS * 1000);
    const user = this.repository.upsertUserAndCreateSession(telegramUser, {
      tokenHash,
      now,
      expiresAt
    });
    this.options.sessionCreationRateLimiter?.record(telegramUser.telegramUserId, now);

    return {
      token,
      expiresAt,
      user: this.toAuthenticatedUser(user)
    };
  }

  resolveSession(token: string | undefined): AuthenticatedUser | null {
    if (!isOpaqueSessionToken(token)) {
      return null;
    }

    const user = this.repository.findUserBySessionHash(hashSessionToken(token), this.now());
    return user ? this.toAuthenticatedUser(user) : null;
  }

  endSession(token: string | undefined): void {
    if (!isOpaqueSessionToken(token)) {
      return;
    }

    this.repository.deleteSession(hashSessionToken(token));
  }

  private toAuthenticatedUser(user: Omit<AuthenticatedUser, 'isAdmin'>): AuthenticatedUser {
    return {
      ...user,
      isAdmin: user.telegramUserId === this.options.adminTelegramChatId
    };
  }
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function isOpaqueSessionToken(token: string | undefined): token is string {
  return typeof token === 'string' && /^[A-Za-z\d_-]{43}$/.test(token);
}
