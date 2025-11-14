import { Queue } from 'bullmq';
import { config } from '../config/env';

const redisConnection: any = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

// Queue for client webhook ingestion
export const clientWebhookQueue = new Queue('client-webhook-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { age: 60 * 60, count: 1000 },
    removeOnFail: { age: 60 * 60, count: 1000 },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

export default clientWebhookQueue;
