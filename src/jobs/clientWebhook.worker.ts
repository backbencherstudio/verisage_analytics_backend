import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';

const prisma = new PrismaClient();

const redisConnection: any = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const worker = new Worker(
  'client-webhook-queue',
  async (job) => {
    const data = job.data as any;

    try {
      if (data.eventId) {
        const existing = await prisma.clientWebhookEvent.findFirst({ where: { eventId: data.eventId } }).catch(() => null);
        if (existing) {
          console.log(`Skipping duplicate event ${data.eventId}`);
          return { skipped: true };
        }
      }

      const created = await prisma.clientWebhookEvent.create({
        data: {
          eventId: data.eventId ?? null,
          eventType: data.eventType ?? null,
          timestamp: data.timestamp ? new Date(data.timestamp) : null,
          startedAt: data.startedAt ? new Date(data.startedAt) : null,
          completedAt: data.completedAt ? new Date(data.completedAt) : null,
          tokenId: data.tokenId ?? null,
          userId: data.userId ?? null,
          action_Name: data.actionName ?? null,
          durationMs: data.durationMs ?? null,
          payload: data.payload ?? null,
          receivedAt: new Date(),
        } as any,
      });

      console.log('Persisted webhook event', created.id);
      return { persisted: true, id: created.id };
    } catch (err: any) {
      console.error('Worker failed to persist webhook event:', err);
      throw err;
    }
  },
  { connection: redisConnection }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err?.message || err);
});

process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('Client webhook worker started');
