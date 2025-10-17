import app from './app';
import { config, validateEnv } from './config/env';
import { prisma } from './db/prisma';
import { startGA4CronJob } from './jobs/ga4.cron';
import { startStripeSyncCronJob } from './jobs/stripe.sync.cron';

// Start the server
const startServer = async () => {
  try {
    // Validate environment variables
    validateEnv();
    console.log('✓ Environment variables validated');

    // Test database connection (optional for live-only metrics)
    try {
      await prisma.$connect();
      console.log('✓ Database connected successfully');
    } catch (dbErr) {
      if (!config.database.allowStartWithoutDb) {
        throw dbErr;
      }
      console.warn('! Database not available, continuing because ALLOW_START_WITHOUT_DB=true');
    }

    // Start GA4 cron job only if enabled
    if (config.ga4.enabled) {
      startGA4CronJob();
      console.log('✓ GA4 sync cron job started');
    }

    // Start Stripe sync cron job (every 1 minute)
    startStripeSyncCronJob();
    console.log('✓ Stripe sync cron job started');

    // Start Express server
    app.listen(config.port, () => {
      console.log(`✓ Server running on port ${config.port}`);
      console.log(`✓ Environment: ${config.nodeEnv}`);
      console.log(`✓ Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
