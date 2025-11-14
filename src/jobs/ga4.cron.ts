import cron from 'node-cron';
import { config } from '../config/env';
import { syncGA4Data } from '../services/ga4.service';

/**
 * Start GA4 data sync cron job
 */
export const startGA4CronJob = () => {
  const schedule = config.ga4.syncSchedule;

  console.log(`Scheduling GA4 sync job with schedule: ${schedule}`);

  cron.schedule(schedule, async () => {
    console.log('Running scheduled GA4 data sync...');
    try {
      await syncGA4Data();
      console.log('Scheduled GA4 sync completed successfully');
    } catch (error) {
      console.error('Error in scheduled GA4 sync:', error);
    }
  });

  // Optional: Run initial sync on startup
  console.log('Running initial GA4 data sync...');
  syncGA4Data()
    .then(async () => {
      // initial sync completed
    })
    .catch((error) => {
      console.error('Error in initial GA4 sync:', error);
    });
};
