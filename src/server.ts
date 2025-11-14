import app from './app';
import { config, validateEnv } from './config/env';
import { prisma } from './db/prisma';
import { startGA4CronJob } from './jobs/ga4.cron';
import { startStripeSyncCronJob } from './jobs/stripe.sync.cron';
import { spawn } from 'child_process';
import path from 'path';

// Keep reference to spawned worker so we can clean it up on shutdown
let workerProcess: any = null;

// Start the server
const startServer = async () => {
  try {
    validateEnv();
    console.log('✓ Environment variables validated');

    try {
      await prisma.$connect();
      console.log('✓ Database connected successfully');
    } catch (dbErr) {
      if (!config.database.allowStartWithoutDb) {
        throw dbErr;
      }
      console.warn('! Database not available, continuing because ALLOW_START_WITHOUT_DB=true');
    }

    if (config.ga4.enabled) {
      startGA4CronJob();
      console.log(`✓ GA4 sync cron job started (schedule: ${config.ga4.syncSchedule})`);
    }

    // Start Stripe sync cron job (every 1 minute)
    startStripeSyncCronJob();
    console.log(`✓ Stripe sync cron job started (schedule: ${config.stripe.syncSchedule})`);

    // Start Express server
    app.listen(config.port, () => {
      console.log(`✓ Server running on port ${config.port}`);
      console.log(`✓ Environment: ${config.nodeEnv}`);
      console.log(`✓ Health check: http://localhost:${config.port}/health`);
    });

    if (config.clientWebhook && config.clientWebhook.startWorker) {
      try {
        if (config.nodeEnv === 'development') {
          // In dev, run the npm script which invokes ts-node
          workerProcess = spawn('npm', ['run', 'worker'], { shell: true, stdio: 'inherit' });
        } else {
          // In production, run the compiled worker under node
          const workerPath = path.resolve(process.cwd(), 'dist', 'jobs', 'clientWebhook.worker.js');
          workerProcess = spawn(process.execPath, [workerPath], { stdio: 'inherit' });
        }

        console.log('✓ Spawned client webhook worker (pid=' + (workerProcess && workerProcess.pid) + ')');

        // If the worker exits unexpectedly, log it.
        workerProcess.on && workerProcess.on('exit', (code: number, sig: string) => {
          console.error(`Client webhook worker exited with code=${code} signal=${sig}`);
        });
      } catch (err) {
        console.error('Failed to spawn client webhook worker:', err);
      }
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (workerProcess) {
    try { workerProcess.kill(); } catch (e) { /* ignore */ }
  }
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (workerProcess) {
    try { workerProcess.kill(); } catch (e) { /* ignore */ }
  }
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
