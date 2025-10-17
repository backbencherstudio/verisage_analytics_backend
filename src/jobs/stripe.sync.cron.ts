import cron from 'node-cron';
import { syncAllStripeDataToDb } from '../services/stripe.service';

export const startStripeSyncCronJob = () => {
  // Runs every 1 minute
  cron.schedule('* * * * *', async () => {
    try {
      // console.log('[Stripe Sync Cron] Starting sync...');
      await syncAllStripeDataToDb();
      // console.log('[Stripe Sync Cron] Sync completed.');
    } catch (error) {
      console.error('[Stripe Sync Cron] Error:', error);
    }
  });
  console.log('[Stripe Sync Cron] Scheduled to run every 1 minute.');
};
