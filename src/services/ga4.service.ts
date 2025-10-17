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

    // Expanded metrics and dimensions
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
      // Batch upserts for efficiency
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
 * Get GA4 metrics from database with comprehensive aggregation
 */
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
        .slice(0, 10), // Top 10 countries
      byDevice: Object.entries(byDevice)
        .map(([device, data]) => ({ device, ...data as any }))
        .sort((a, b) => b.activeUsers - a.activeUsers),
    },
    rawMetrics: metrics,
  };
};
