import { runDemoJob } from './lib/server/jobs/demo';
import { loadWorkerConfig } from './lib/server/config/schema';
import { openDatabase } from './lib/server/db/client';
import { UserSessionRepository } from './lib/server/db/repositories/user-session-repository';
import { SessionHousekeeping } from './lib/server/auth/housekeeping';

function writeLog(
  event: string,
  level: 'info' | 'error',
  details: Readonly<{ errorCode?: string; deletedCount?: number }> = {}
): void {
  console[level](
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'worker',
      event,
      ...(details.errorCode === undefined ? {} : { errorCode: details.errorCode }),
      ...(details.deletedCount === undefined ? {} : { deletedCount: details.deletedCount })
    })
  );
}

function waitForShutdown(): Promise<void> {
  return new Promise((resolve) => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
}

async function main(): Promise<void> {
  const config = loadWorkerConfig(process.env);
  const database = openDatabase(config.databaseUrl);
  const sessionHousekeeping = new SessionHousekeeping(new UserSessionRepository(database.db), {
    onComplete: (deletedCount) => writeLog('sessions.cleanup.completed', 'info', { deletedCount }),
    onError: () =>
      writeLog('sessions.cleanup.failed', 'error', {
        errorCode: 'SESSION_CLEANUP_FAILED'
      })
  });

  try {
    database.sqlite.prepare('select 1 from jobs limit 1').get();
    sessionHousekeeping.start();

    if (process.argv.includes('--demo')) {
      await runDemoJob(async () => writeLog('demo_job.completed', 'info'));
    }
    writeLog('worker.ready', 'info');

    await waitForShutdown();
    writeLog('worker.stopped', 'info');
  } finally {
    sessionHousekeeping.stop();
    database.close();
  }
}

void main().catch(() => {
  writeLog('worker.failed', 'error', { errorCode: 'WORKER_START_FAILED' });
  process.exitCode = 1;
});
