import { resolve } from 'node:path';
import type { Cookies } from '@sveltejs/kit';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionCookie, SESSION_COOKIE_NAME, setSessionCookie } from '$lib/server/auth/cookie';
import { AuthRateLimitError, SlidingWindowRateLimiter } from '$lib/server/auth/rate-limit';
import { AuthService, hashSessionToken } from '$lib/server/auth/session';
import { openDatabase, type DatabaseClient } from '$lib/server/db/client';
import { UserSessionRepository } from '$lib/server/db/repositories/user-session-repository';
import { sessions, users } from '$lib/server/db/schema';
import { createTelegramInitData, TEST_TELEGRAM_BOT_TOKEN } from '../helpers/telegram';

const firstToken = 'a'.repeat(43);
const secondToken = 'b'.repeat(43);

describe('Telegram authentication sessions', () => {
  let database: DatabaseClient;
  let now: Date;
  let tokens: string[];
  let service: AuthService;

  beforeEach(() => {
    database = openDatabase(':memory:');
    migrate(database.db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
    now = new Date(1_700_000_000_000);
    tokens = [firstToken, secondToken];
    service = new AuthService(new UserSessionRepository(database.db), {
      telegramBotToken: TEST_TELEGRAM_BOT_TOKEN,
      adminTelegramChatId: '900719925474099',
      now: () => new Date(now),
      createToken: () => {
        const token = tokens.shift();
        if (!token) throw new Error('Test token fixture exhausted');
        return token;
      }
    });
  });

  afterEach(() => {
    database.close();
  });

  it('upserts a user and persists only the SHA-256 session token hash', () => {
    const rawInitData = createTelegramInitData();
    const authenticated = service.authenticateWithTelegram(rawInitData);

    expect(authenticated).toMatchObject({
      token: firstToken,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      user: {
        telegramUserId: '900719925474099',
        username: 'test_user',
        firstName: 'Test',
        lastName: 'User',
        photoUrl: 'https://example.test/avatar.jpg',
        languageCode: 'en',
        isAdmin: true
      }
    });

    expect(database.db.select().from(users).all()).toHaveLength(1);
    const storedSessions = database.db.select().from(sessions).all();
    expect(storedSessions).toHaveLength(1);
    expect(storedSessions[0]?.tokenHash).toBe(hashSessionToken(firstToken));
    expect(storedSessions[0]?.tokenHash).not.toContain(firstToken);
    expect(JSON.stringify(storedSessions)).not.toContain(firstToken);
    expect(JSON.stringify(database.db.select().from(users).all())).not.toContain(rawInitData);
  });

  it('updates the existing Telegram user on every successful authentication', () => {
    const first = service.authenticateWithTelegram(createTelegramInitData());
    now = new Date(now.getTime() + 60_000);

    const second = service.authenticateWithTelegram(
      createTelegramInitData({
        authDate: Math.floor(now.getTime() / 1000),
        user: {
          id: 900719925474099,
          username: 'renamed_user',
          first_name: 'Updated',
          language_code: 'de'
        }
      })
    );

    const storedUsers = database.db.select().from(users).all();
    expect(storedUsers).toHaveLength(1);
    expect(storedUsers[0]).toMatchObject({
      id: first.user.id,
      username: 'renamed_user',
      firstName: 'Updated',
      lastName: null,
      photoUrl: null,
      languageCode: 'de',
      lastAuthAt: now,
      updatedAt: now
    });
    expect(second.user.id).toBe(first.user.id);
    expect(database.db.select().from(sessions).all()).toHaveLength(2);
  });

  it('resolves only a fresh session and throttles its last-seen update', () => {
    const authenticated = service.authenticateWithTelegram(createTelegramInitData());
    now = new Date(now.getTime() + 30_000);

    expect(service.resolveSession(authenticated.token)).toEqual(authenticated.user);
    expect(database.db.select().from(sessions).get()?.lastSeenAt).toEqual(
      new Date(now.getTime() - 30_000)
    );

    now = new Date(now.getTime() + 30_000);
    expect(service.resolveSession(authenticated.token)).toEqual(authenticated.user);
    expect(database.db.select().from(sessions).get()?.lastSeenAt).toEqual(now);

    now = new Date(authenticated.expiresAt.getTime());
    expect(service.resolveSession(authenticated.token)).toBeNull();
    expect(new UserSessionRepository(database.db).deleteExpiredSessions(now)).toBe(1);
    expect(database.db.select().from(sessions).all()).toEqual([]);
  });

  it('deletes the server-side session on logout', () => {
    const authenticated = service.authenticateWithTelegram(createTelegramInitData());

    service.endSession(authenticated.token);

    expect(service.resolveSession(authenticated.token)).toBeNull();
    expect(database.db.select().from(sessions).all()).toEqual([]);
  });

  it.each([
    createTelegramInitData().replace('test_user', 'forged_user'),
    createTelegramInitData({ authDate: 1_699_999_699 })
  ])('does not persist a user or session for rejected init data', (rawInitData) => {
    expect(() => service.authenticateWithTelegram(rawInitData)).toThrow();

    expect(database.db.select().from(users).all()).toEqual([]);
    expect(database.db.select().from(sessions).all()).toEqual([]);
  });

  it('does not query or mutate sessions for malformed cookie tokens', () => {
    expect(service.resolveSession('not-an-opaque-token')).toBeNull();
    service.endSession('not-an-opaque-token');

    expect(database.db.select().from(sessions).all()).toEqual([]);
  });

  it('enforces auth sliding windows before creating excess sessions', () => {
    const limitedService = new AuthService(new UserSessionRepository(database.db), {
      telegramBotToken: TEST_TELEGRAM_BOT_TOKEN,
      adminTelegramChatId: '900719925474099',
      now: () => new Date(now),
      createToken: () =>
        `${String(database.db.select().from(sessions).all().length).padStart(43, 'a')}`,
      sessionCreationRateLimiter: new SlidingWindowRateLimiter(5, 5 * 60_000)
    });

    for (let index = 0; index < 5; index += 1) {
      limitedService.authenticateWithTelegram(createTelegramInitData());
    }

    expect(() => limitedService.authenticateWithTelegram(createTelegramInitData())).toThrow(
      AuthRateLimitError
    );
    expect(database.db.select().from(sessions).all()).toHaveLength(5);

    const attemptLimiter = new SlidingWindowRateLimiter(2, 60_000);
    expect(attemptLimiter.consume('127.0.0.1', now)).toEqual({ allowed: true });
    expect(attemptLimiter.consume('127.0.0.1', now)).toEqual({ allowed: true });
    expect(attemptLimiter.consume('127.0.0.1', now)).toEqual({
      allowed: false,
      retryAfterSeconds: 60
    });
  });
});

describe('session cookie', () => {
  it('uses the required seven-day secure cookie attributes', () => {
    const set = vi.fn();
    const expiresAt = new Date(1_700_604_800_000);
    const cookies = { set } as unknown as Cookies;

    setSessionCookie(cookies, {
      token: firstToken,
      expiresAt,
      user: {
        id: 'internal-user-id',
        telegramUserId: '42',
        username: null,
        firstName: 'Test',
        lastName: null,
        photoUrl: null,
        languageCode: null,
        isAdmin: false
      }
    });

    expect(set).toHaveBeenCalledWith(SESSION_COOKIE_NAME, firstToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt
    });
  });

  it('clears the same secure cookie scope', () => {
    const deleteCookie = vi.fn();
    const cookies = { delete: deleteCookie } as unknown as Cookies;

    clearSessionCookie(cookies);

    expect(deleteCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/'
    });
  });
});
