export const AUTH_ATTEMPT_LIMIT = 10;
export const AUTH_ATTEMPT_WINDOW_MS = 60_000;
export const AUTH_USER_SESSION_LIMIT = 5;
export const AUTH_USER_SESSION_WINDOW_MS = 5 * 60_000;

export type RateLimitDecision =
  Readonly<{ allowed: true }> | Readonly<{ allowed: false; retryAfterSeconds: number }>;

export interface SessionCreationRateLimiter {
  check(key: string, now: Date): RateLimitDecision;
  record(key: string, now: Date): void;
}

export class AuthRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Authentication rate limit exceeded');
    this.name = 'AuthRateLimitError';
  }
}

export class SlidingWindowRateLimiter implements SessionCreationRateLimiter {
  private readonly attemptsByKey = new Map<string, number[]>();
  private nextSweepAt = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      !Number.isSafeInteger(windowMs) ||
      windowMs < 1
    ) {
      throw new Error('Rate limit and window must be positive integers');
    }
  }

  consume(key: string, now: Date): RateLimitDecision {
    const attempts = this.getCurrentAttempts(key, now.getTime());
    const decision = this.toDecision(attempts, now.getTime());
    if (!decision.allowed) return decision;

    attempts.push(now.getTime());
    this.attemptsByKey.set(key, attempts);
    return decision;
  }

  check(key: string, now: Date): RateLimitDecision {
    return this.toDecision(this.getCurrentAttempts(key, now.getTime()), now.getTime());
  }

  record(key: string, now: Date): void {
    const attempts = this.getCurrentAttempts(key, now.getTime());
    attempts.push(now.getTime());
    this.attemptsByKey.set(key, attempts);
  }

  private getCurrentAttempts(key: string, nowMs: number): number[] {
    this.sweepExpiredKeys(nowMs);
    const cutoff = nowMs - this.windowMs;
    return (this.attemptsByKey.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
  }

  private toDecision(attempts: readonly number[], nowMs: number): RateLimitDecision {
    if (attempts.length < this.limit) {
      return { allowed: true };
    }

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((attempts[0]! + this.windowMs - nowMs) / 1000))
    };
  }

  private sweepExpiredKeys(nowMs: number): void {
    if (nowMs < this.nextSweepAt) return;

    const cutoff = nowMs - this.windowMs;
    for (const [key, attempts] of this.attemptsByKey) {
      const currentAttempts = attempts.filter((timestamp) => timestamp > cutoff);
      if (currentAttempts.length === 0) {
        this.attemptsByKey.delete(key);
      } else {
        this.attemptsByKey.set(key, currentAttempts);
      }
    }
    this.nextSweepAt = nowMs + this.windowMs;
  }
}
