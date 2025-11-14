import { prisma } from '../db/prisma';
import { listTopEvents, sampleEventParams } from './ga4.service';


export const materializeGA4TopEvents = async (days = 30, topN = 500) => {
  console.log('Materializing GA4 top events into DB (Data API)...');
  const rows = await listTopEvents(days, topN);

  const db: any = prisma;
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  const ops = rows.map((r: any) => {
    const eventName = r.eventName || r.event_name || '(unknown)';
    const total = typeof r.total === 'string' ? parseInt(r.total, 10) : r.total || 0;
    return db.gA4EventAggregate.upsert({
      where: { date_eventName: { date, eventName } },
      update: { total },
      create: { date, eventName, total },
    });
  });

  const BATCH = 20;
  for (let i = 0; i < ops.length; i += BATCH) {
    await Promise.all(ops.slice(i, i + BATCH));
  }

  console.log(`Materialized ${rows.length} GA4 event aggregates.`);
};


export const materializeGA4EventParams = async (eventName: string, paramKey: string, days = 30, limit = 100) => {
  console.log(`Materializing GA4 param aggregates for ${eventName}/${paramKey}...`);
  const rows = await sampleEventParams(eventName, paramKey, days, limit);

  const db: any = prisma;
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  const ops = rows.map((r: any) => {
    const paramValue = r.paramValue || r.param_value || null;
    const total = typeof r.total === 'string' ? parseInt(r.total, 10) : r.total || 0;
    return db.gA4EventParamAggregate.upsert({
      where: { date_eventName_paramKey_paramValue: { date, eventName, paramKey, paramValue: paramValue } },
      update: { total },
      create: { date, eventName, paramKey, paramValue: paramValue, total },
    });
  });

  const BATCH = 20;
  for (let i = 0; i < ops.length; i += BATCH) {
    await Promise.all(ops.slice(i, i + BATCH));
  }

  console.log(`Materialized ${rows.length} GA4 event param aggregates for ${eventName}/${paramKey}.`);
};


export const materializeGA4EventSamples = async (_eventName: string, _days = 7, _limit = 100) => {
  throw new Error('Raw event sampling requires GA4 BigQuery export. This backend is running in Data API-only mode.');
};

export default {
  materializeGA4TopEvents,
  materializeGA4EventParams,
  materializeGA4EventSamples,
};
