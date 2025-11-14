import cron from 'node-cron';
import { syncAllStripeDataToDb } from '../services/stripe.service';
import { config } from '../config/env';

export const startStripeSyncCronJob = () => {
  const schedule = config.stripe.syncSchedule || '0 3 * * *';
  cron.schedule(schedule, async () => {
    try {
      console.log(`[Stripe Sync Cron] Running scheduled sync (${schedule})...`);
      await syncAllStripeDataToDb();
      console.log('[Stripe Sync Cron] Sync completed.');
    } catch (error) {
      console.error('[Stripe Sync Cron] Error:', error);
    }
  });
  console.log(`[Stripe Sync Cron] Scheduled to run: ${schedule}`);
};
