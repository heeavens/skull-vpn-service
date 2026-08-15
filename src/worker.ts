import { runDemoJob } from './lib/server/jobs/demo';
import { loadWorkerConfig } from './lib/server/config/schema';
import { openDatabase } from './lib/server/db/client';

function writeLog(event: string, level: 'info' | 'error', errorCode?: string): void {
  console[level](
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'worker',
      event,
      ...(errorCode === undefined ? {} : { errorCode })
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

  try {
    database.sqlite.prepare('select 1 from jobs limit 1').get();
  } finally {
    database.close();
  }

  if (process.argv.includes('--demo')) {
    await runDemoJob(async () => writeLog('demo_job.completed', 'info'));
  }
  writeLog('worker.ready', 'info');

  await waitForShutdown();
  writeLog('worker.stopped', 'info');
}

void main().catch(() => {
  writeLog('worker.failed', 'error', 'WORKER_START_FAILED');
  process.exitCode = 1;
});
