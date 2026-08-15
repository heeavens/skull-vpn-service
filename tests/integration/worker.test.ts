import { describe, expect, it, vi } from 'vitest';

import {
  SESSION_CLEANUP_INTERVAL_MS,
  SessionHousekeeping
} from '../../src/lib/server/auth/housekeeping';
import { runDemoJob } from '../../src/lib/server/jobs/demo';

describe('worker runtime', () => {
  it('executes its demo effect once', async () => {
    const effect = vi.fn(async () => undefined);

    await runDemoJob(effect);

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('reports an effect failure to its caller', async () => {
    const error = new Error('demo failed');

    await expect(runDemoJob(async () => Promise.reject(error))).rejects.toBe(error);
  });

  it('cleans expired sessions at startup and hourly until stopped', () => {
    vi.useFakeTimers();
    const repository = { deleteExpiredSessions: vi.fn(() => 2) };
    const housekeeping = new SessionHousekeeping(repository);

    try {
      housekeeping.start();
      expect(repository.deleteExpiredSessions).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(SESSION_CLEANUP_INTERVAL_MS);
      expect(repository.deleteExpiredSessions).toHaveBeenCalledTimes(2);

      housekeeping.stop();
      vi.advanceTimersByTime(SESSION_CLEANUP_INTERVAL_MS);
      expect(repository.deleteExpiredSessions).toHaveBeenCalledTimes(2);
    } finally {
      housekeeping.stop();
      vi.useRealTimers();
    }
  });
});
