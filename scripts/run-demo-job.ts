import { runDemoJob } from '../src/lib/server/jobs/demo';

await runDemoJob(async () => {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'worker-demo',
      event: 'demo_job.completed'
    })
  );
});
