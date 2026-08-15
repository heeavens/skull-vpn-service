export const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export interface ExpiredSessionStore {
  deleteExpiredSessions(now: Date): number;
}

type SessionHousekeepingOptions = Readonly<{
  now?: () => Date;
  onComplete?: (deletedCount: number) => void;
  onError?: () => void;
}>;

export class SessionHousekeeping {
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly now: () => Date;

  constructor(
    private readonly repository: ExpiredSessionStore,
    private readonly options: SessionHousekeepingOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  start(): void {
    if (this.timer) return;

    this.cleanup();
    this.timer = setInterval(() => this.cleanup(), SESSION_CLEANUP_INTERVAL_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) return;

    clearInterval(this.timer);
    this.timer = undefined;
  }

  private cleanup(): void {
    try {
      const deletedCount = this.repository.deleteExpiredSessions(this.now());
      this.options.onComplete?.(deletedCount);
    } catch {
      this.options.onError?.();
    }
  }
}
