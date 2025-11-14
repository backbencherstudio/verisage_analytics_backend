import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { config } from '../config/env';
import { prisma } from '../db/prisma';

// Initialize GA4 client
const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: config.ga4.credentialsPath,
});

/**
 * Fetch GA4 metrics and store in database
 */
export const syncGA4Data = async () => {
  try {
    console.log('Starting GA4 data sync...');

    const propertyId = config.ga4.propertyId;
    // Define date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const dimensions = [
      { name: 'date' },
      { name: 'country' },
      { name: 'deviceCategory' },
      { name: 'city' },
      { name: 'browser' },
      { name: 'operatingSystem' },
      { name: 'sessionSource' },
    ];
    const metrics = [
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'sessions' },
      { name: 'engagedSessions' },
      { name: 'engagementRate' },
      { name: 'eventCount' },
      { name: 'conversions' },
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
    ];

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
      ],
      dimensions,
      metrics,
    });

    // Prepare batch upserts
    const upserts = [];
    if (response.rows) {
      for (const row of response.rows) {
        let date = row.dimensionValues?.[0]?.value || '';
        if (/^\d{8}$/.test(date)) {
          date = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
        }
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
          console.warn(`Skipping row with invalid date: ${date}`);
          continue;
        }
        const country = row.dimensionValues?.[1]?.value || '';
        const deviceCategory = row.dimensionValues?.[2]?.value || '';
        const city = row.dimensionValues?.[3]?.value || '';
        const browser = row.dimensionValues?.[4]?.value || '';
        const operatingSystem = row.dimensionValues?.[5]?.value || '';
        const trafficSource = row.dimensionValues?.[6]?.value || '';

        // Metrics (order must match metrics array above)
        const activeUsers = parseInt(row.metricValues?.[0]?.value || '0');
        const newUsers = parseInt(row.metricValues?.[1]?.value || '0');
        const sessions = parseInt(row.metricValues?.[2]?.value || '0');
        const engagedSessions = parseInt(row.metricValues?.[3]?.value || '0');
        const engagementRate = parseFloat(row.metricValues?.[4]?.value || '0');
        const eventCount = parseInt(row.metricValues?.[5]?.value || '0');
        const conversions = parseInt(row.metricValues?.[6]?.value || '0');
        const pageViews = parseInt(row.metricValues?.[7]?.value || '0');
        const avgSessionDuration = parseFloat(row.metricValues?.[8]?.value || '0');
        const bounceRate = parseFloat(row.metricValues?.[9]?.value || '0');

        upserts.push(
          prisma.gA4Metric.upsert({
            where: {
              date_country_deviceCategory_city_browser_operatingSystem_trafficSource: {
                date: parsedDate,
                country,
                deviceCategory,
                city,
                browser,
                operatingSystem,
                trafficSource,
              },
            },
            update: {
              activeUsers,
              newUsers,
              sessions,
              engagedSessions,
              engagementRate,
              eventCount,
              conversions,
              pageViews,
              avgSessionDuration,
              bounceRate,
              city,
              browser,
              operatingSystem,
              trafficSource,
            },
            create: {
              date: parsedDate,
              country,
              deviceCategory,
              city,
              browser,
              operatingSystem,
              trafficSource,
              activeUsers,
              newUsers,
              sessions,
              engagedSessions,
              engagementRate,
              eventCount,
              conversions,
              pageViews,
              avgSessionDuration,
              bounceRate,
            },
          })
        );
      }
      const BATCH_SIZE = 50;
      for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
        await Promise.all(upserts.slice(i, i + BATCH_SIZE));
      }
    }
    console.log(`GA4 data sync completed. Processed ${response.rows?.length || 0} rows.`);
  } catch (error) {
    console.error('Error syncing GA4 data:', error);
    throw error;
  }
};

/**
 * List top events using the Analytics Data API (eventName + eventCount)
 */
export const listTopEvents = async (days = 30, limit = 200) => {
  const propertyId = config.ga4.propertyId;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
      ],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      limit: limit,
    });

    const rows = (response.rows || []).map((r: any) => {
      const eventName = r.dimensionValues?.[0]?.value || '';
      const total = parseInt(r.metricValues?.[0]?.value || '0', 10);
      return { eventName, total };
    });
    return rows;
  } catch (err) {
    console.error('Error listing top events from GA4 Data API:', err);
    throw err;
  }
};


export const sampleEventParams = async (eventName: string, paramKey: string, days = 30, limit = 100) => {
  if (!paramKey) throw new Error('paramKey is required');
  const propertyId = config.ga4.propertyId;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const paramDimension = `eventParam:${paramKey}`;

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
      ],
      dimensions: [{ name: 'eventName' }, { name: paramDimension }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'eventName',
                stringFilter: { matchType: 'EXACT', value: eventName },
              },
            },
          ],
        },
      },
      limit: limit,
    } as any);

    const rows = (response.rows || []).map((r: any) => {
      const paramValue = r.dimensionValues?.[1]?.value || null;
      const total = parseInt(r.metricValues?.[0]?.value || '0', 10);
      return { paramValue, total };
    });
    return rows;
  } catch (err: any) {
    const message = err?.message || String(err);
    console.error('Error sampling event params from GA4 Data API:', message);
    throw new Error(
      `Unable to sample event params via Analytics Data API. The Data API may not expose raw params for this property. Error: ${message}`
    );
  }
};


export const discoverEventParams = async (
  eventName: string,
  candidates: string[] = ['token_id', 'video_id', 'video_percent', 'video_progress', 'value', 'label', 'category', 'media_type'],
  days = 30,
  sampleLimit = 10
) => {
  const results: Array<{ paramKey: string; total: number; sampleValues: Array<string | null> }> = [];
  for (const key of candidates) {
    try {
      const rows = await sampleEventParams(eventName, key, days, sampleLimit);
      if (rows && rows.length > 0) {
        const sampleValues = rows.map((r: any) => r.paramValue ?? null).slice(0, sampleLimit);
        const total = rows.reduce((s: number, r: any) => s + (typeof r.total === 'string' ? parseInt(r.total, 10) : r.total || 0), 0);
        results.push({ paramKey: key, total, sampleValues });
      }
    } catch (err) {
      continue;
    }
  }

  return results;
};


export const listEventDetails = async (days = 30, limitEvents = 500, limitBreakdown = 10) => {
  const propertyId = config.ga4.propertyId;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
      ],
      dimensions: [{ name: 'eventName' }, { name: 'country' }, { name: 'deviceCategory' }],
      metrics: [{ name: 'eventCount' }],
      limit: 100000, 
    } as any);

    const map: Record<string, any> = {};
    const rows = response.rows || [];
    for (const r of rows) {
      const eventName = r.dimensionValues?.[0]?.value || '(unknown)';
      const country = r.dimensionValues?.[1]?.value || 'unknown';
      const device = r.dimensionValues?.[2]?.value || 'unknown';
      const count = parseInt(r.metricValues?.[0]?.value || '0', 10);

      if (!map[eventName]) map[eventName] = { eventName, total: 0, byCountry: {}, byDevice: {} };
      map[eventName].total += count;
      map[eventName].byCountry[country] = (map[eventName].byCountry[country] || 0) + count;
      map[eventName].byDevice[device] = (map[eventName].byDevice[device] || 0) + count;
    }

    // Convert map to array and sort by total
    const results = Object.values(map)
      .map((e: any) => {
        const byCountry = Object.entries(e.byCountry)
          .map(([k, v]) => ({ country: k, total: v }))
          .sort((a: any, b: any) => (b.total as number) - (a.total as number))
          .slice(0, limitBreakdown);

        const byDevice = Object.entries(e.byDevice)
          .map(([k, v]) => ({ device: k, total: v }))
          .sort((a: any, b: any) => (b.total as number) - (a.total as number))
          .slice(0, limitBreakdown);

        return { eventName: e.eventName, total: e.total, byCountry, byDevice };
      })
      .sort((a: any, b: any) => (b.total as number) - (a.total as number))
      .slice(0, limitEvents);

    return results;
  } catch (err) {
    console.error('Error listing event details from GA4 Data API:', err);
    throw err;
  }
};


export const getEventDetail = async (
  eventName: string,
  days = 30,
  limitBreakdown = 20
) => {
  const propertyId = config.ga4.propertyId;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result: any = { eventName, total: 0, timeseries: [], byCountry: [], byDevice: [], byBrowser: [], byCity: [], params: null };

  try {
    // 1) timeseries by date
    const [tsResp] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: eventName } } },
      limit: 10000,
    } as any);

    if (tsResp.rows) {
      result.timeseries = tsResp.rows.map((r: any) => ({ date: r.dimensionValues?.[0]?.value, total: parseInt(r.metricValues?.[0]?.value || '0', 10) }));
      result.total = result.timeseries.reduce((s: number, r: any) => s + (r.total || 0), 0);
    }

    // Helper to fetch breakdowns
    async function fetchBreakdown(dimensionName: string) {
      const [resp] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] }],
        dimensions: [{ name: dimensionName }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: eventName } } },
        limit: 10000,
      } as any);
      const rows = resp.rows || [];
      return rows.map((r: any) => ({ key: r.dimensionValues?.[0]?.value || 'unknown', total: parseInt(r.metricValues?.[0]?.value || '0', 10) })).sort((a: any, b: any) => b.total - a.total).slice(0, limitBreakdown);
    }

    const [byCountry, byDevice, byBrowser, byCity] = await Promise.all([
      fetchBreakdown('country'),
      fetchBreakdown('deviceCategory'),
      fetchBreakdown('browser'),
      fetchBreakdown('city'),
    ]);

    result.byCountry = byCountry;
    result.byDevice = byDevice;
    result.byBrowser = byBrowser;
    result.byCity = byCity;

    result.params = { supported: false, message: 'Use /events/:name/params?paramKey=your_param to sample specific parameter values via the Data API. For full raw params enable BigQuery export.' };

    return result;
  } catch (err) {
    console.error('Error getting event detail from GA4 Data API:', err);
    throw err;
  }
};


export const getGA4Metrics = async (filter?: {
  startDate?: Date;
  endDate?: Date;
}) => {
  const where: any = {};

  if (filter?.startDate || filter?.endDate) {
    where.date = {};
    if (filter.startDate) where.date.gte = filter.startDate;
    if (filter.endDate) where.date.lte = filter.endDate;
  }

  const metrics = await prisma.gA4Metric.findMany({
    where,
    orderBy: { date: 'desc' },
  });

  const totalCount = metrics.length || 1;

  // Comprehensive aggregation
  const summary = {
    users: {
      totalActiveUsers: metrics.reduce((sum, m) => sum + m.activeUsers, 0),
      totalNewUsers: metrics.reduce((sum, m) => sum + m.newUsers, 0),
    },
    sessions: {
      totalSessions: metrics.reduce((sum, m) => sum + m.sessions, 0),
      totalEngagedSessions: metrics.reduce((sum, m) => sum + m.engagedSessions, 0),
      avgEngagementRate: Math.round(
        (metrics.reduce((sum, m) => sum + m.engagementRate, 0) / totalCount) * 100
      ) / 100,
      avgSessionDuration: Math.round(
        metrics.reduce((sum, m) => sum + m.avgSessionDuration, 0) / totalCount
      ),
    },
    engagement: {
      totalPageViews: metrics.reduce((sum, m) => sum + m.pageViews, 0),
      totalEventCount: metrics.reduce((sum, m) => sum + m.eventCount, 0),
      totalConversions: metrics.reduce((sum, m) => sum + m.conversions, 0),
      avgBounceRate: Math.round(
        (metrics.reduce((sum, m) => sum + m.bounceRate, 0) / totalCount) * 100
      ) / 100,
    },
    period: {
      startDate: filter?.startDate || null,
      endDate: filter?.endDate || null,
      totalRows: metrics.length,
    },
  };

  // Organize metrics by dimension for better insights
  const byCountry = metrics.reduce((acc: any, m) => {
    if (!acc[m.country]) {
      acc[m.country] = { activeUsers: 0, sessions: 0, pageViews: 0, conversions: 0 };
    }
    acc[m.country].activeUsers += m.activeUsers;
    acc[m.country].sessions += m.sessions;
    acc[m.country].pageViews += m.pageViews;
    acc[m.country].conversions += m.conversions;
    return acc;
  }, {});

  const byDevice = metrics.reduce((acc: any, m) => {
    if (!acc[m.deviceCategory]) {
      acc[m.deviceCategory] = { activeUsers: 0, sessions: 0, pageViews: 0, conversions: 0 };
    }
    acc[m.deviceCategory].activeUsers += m.activeUsers;
    acc[m.deviceCategory].sessions += m.sessions;
    acc[m.deviceCategory].pageViews += m.pageViews;
    acc[m.deviceCategory].conversions += m.conversions;
    return acc;
  }, {});

  return {
    summary,
    breakdown: {
      byCountry: Object.entries(byCountry)
        .map(([country, data]) => ({ country, ...data as any }))
        .sort((a, b) => b.activeUsers - a.activeUsers)
        .slice(0, 10), 
      byDevice: Object.entries(byDevice)
        .map(([device, data]) => ({ device, ...data as any }))
        .sort((a, b) => b.activeUsers - a.activeUsers),
    },
    rawMetrics: metrics,
  };
};
