import { randomUUID } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type { AppDatabase } from '../client';
import { sessions, users } from '../schema';

export type UserProfileInput = Readonly<{
  telegramUserId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  languageCode: string | null;
}>;

export type SessionUserRecord = Readonly<{
  id: string;
  telegramUserId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  languageCode: string | null;
}>;

export interface UserSessionStore {
  upsertUserAndCreateSession(
    profile: UserProfileInput,
    session: Readonly<{ tokenHash: string; now: Date; expiresAt: Date }>
  ): SessionUserRecord;
  findUserBySessionHash(tokenHash: string, now: Date): SessionUserRecord | null;
  deleteSession(tokenHash: string): void;
}

export class UserSessionRepository implements UserSessionStore {
  constructor(private readonly db: AppDatabase) {}

  upsertUserAndCreateSession(
    profile: UserProfileInput,
    session: Readonly<{ tokenHash: string; now: Date; expiresAt: Date }>
  ): SessionUserRecord {
    return this.db.transaction((transaction) => {
      const user = transaction
        .insert(users)
        .values({
          id: randomUUID(),
          telegramUserId: profile.telegramUserId,
          username: profile.username,
          firstName: profile.firstName,
          lastName: profile.lastName,
          photoUrl: profile.photoUrl,
          languageCode: profile.languageCode,
          lastAuthAt: session.now,
          createdAt: session.now,
          updatedAt: session.now
        })
        .onConflictDoUpdate({
          target: users.telegramUserId,
          set: {
            username: profile.username,
            firstName: profile.firstName,
            lastName: profile.lastName,
            photoUrl: profile.photoUrl,
            languageCode: profile.languageCode,
            lastAuthAt: session.now,
            updatedAt: session.now
          }
        })
        .returning({
          id: users.id,
          telegramUserId: users.telegramUserId,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          photoUrl: users.photoUrl,
          languageCode: users.languageCode
        })
        .get();

      transaction
        .insert(sessions)
        .values({
          tokenHash: session.tokenHash,
          userId: user.id,
          expiresAt: session.expiresAt,
          createdAt: session.now,
          lastSeenAt: session.now
        })
        .run();

      return user;
    });
  }

  findUserBySessionHash(tokenHash: string, now: Date): SessionUserRecord | null {
    const record = this.db
      .select({
        id: users.id,
        telegramUserId: users.telegramUserId,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        photoUrl: users.photoUrl,
        languageCode: users.languageCode,
        lastSeenAt: sessions.lastSeenAt
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
      .get();

    if (!record) {
      return null;
    }

    if (now.getTime() - record.lastSeenAt.getTime() >= 60_000) {
      this.db
        .update(sessions)
        .set({ lastSeenAt: now })
        .where(eq(sessions.tokenHash, tokenHash))
        .run();
    }

    return {
      id: record.id,
      telegramUserId: record.telegramUserId,
      username: record.username,
      firstName: record.firstName,
      lastName: record.lastName,
      photoUrl: record.photoUrl,
      languageCode: record.languageCode
    };
  }

  deleteSession(tokenHash: string): void {
    this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash)).run();
  }
}
