import { prisma } from '../db/prisma';
import { getGA4Metrics } from './ga4.service';

export const getGA4DashboardSummary = async (opts?: { days?: number; topN?: number; paramLimit?: number }) => {
  const days = typeof opts?.days === 'number' ? opts!.days : 30;
  const topN = typeof opts?.topN === 'number' ? opts!.topN : 10;
  const paramLimit = typeof opts?.paramLimit === 'number' ? opts!.paramLimit : 5;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  // normalize date bounds (midnight)
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  // 1) metrics summary (reuse existing service which aggregates GA4Metric rows)
  const metrics = await getGA4Metrics({ startDate, endDate });

  // 2) top events for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const topEventsToday = await prisma.gA4EventAggregate.findMany({ where: { date: today }, orderBy: { total: 'desc' }, take: topN });

  // 3) top events over the requested period (grouped)
  let topEventsPeriod: Array<{ eventName: string; total: number }> = [];
  try {
    const grouped = await prisma.gA4EventAggregate.groupBy({
      by: ['eventName'],
      where: { date: { gte: startDate, lte: endDate } },
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: topN,
    } as any);

    topEventsPeriod = grouped.map((g: any) => ({ eventName: g.eventName, total: (g._sum?.total as number) || 0 }));
  } catch (err) {
    const rows = await prisma.gA4EventAggregate.findMany({ where: { date: { gte: startDate, lte: endDate } } });
    const map: Record<string, number> = {};
    for (const r of rows) map[r.eventName] = (map[r.eventName] || 0) + (r.total || 0);
    topEventsPeriod = Object.entries(map)
      .map(([eventName, total]) => ({ eventName, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, topN);
  }

  // 4) top param values for the top events in the period (limited)
  const topParams: Record<string, Array<{ paramKey: string; paramValue: string | null; total: number }>> = {};
  const eventsToInspect = topEventsPeriod.slice(0, Math.min(topN, 10)).map((e) => e.eventName);
  for (const eventName of eventsToInspect) {
    const paramsRows = await prisma.gA4EventParamAggregate.findMany({
      where: { eventName, date: { gte: startDate, lte: endDate } },
      orderBy: { total: 'desc' },
      take: paramLimit * 5, 
    });

    const byKey: Record<string, Array<{ paramValue: string | null; total: number }>> = {};
    for (const r of paramsRows) {
      const key = r.paramKey || '(unknown)';
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push({ paramValue: r.paramValue ?? null, total: r.total || 0 });
    }

    topParams[eventName] = [];
    for (const [paramKey, vals] of Object.entries(byKey)) {
      vals.sort((a, b) => b.total - a.total);
      const top = vals.slice(0, paramLimit).map((v) => ({ paramKey, paramValue: v.paramValue, total: v.total }));
      topParams[eventName].push(...top);
    }
  }

  return {
    period: { startDate, endDate, days },
    metricsSummary: metrics.summary,
    metricsBreakdown: metrics.breakdown,
    topEventsToday,
    topEventsPeriod,
    topParams,
  };
};

export default { getGA4DashboardSummary };
