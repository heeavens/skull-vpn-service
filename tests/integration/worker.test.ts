import { describe, expect, it, vi } from 'vitest';

import { runDemoJob } from '../../src/lib/server/jobs/demo';

describe('worker demo job', () => {
  it('executes its demo effect once', async () => {
    const effect = vi.fn(async () => undefined);

    await runDemoJob(effect);

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('reports an effect failure to its caller', async () => {
    const error = new Error('demo failed');

    await expect(runDemoJob(async () => Promise.reject(error))).rejects.toBe(error);
  });
});
