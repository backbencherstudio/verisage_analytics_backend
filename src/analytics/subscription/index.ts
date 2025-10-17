// Subscription Analytics Service
// Provides: churn rate, upgrade/downgrade tracking, trial conversion, plan distribution, avg duration, retention cohorts, cancellation reasons

import { prisma } from '../../db/prisma';

interface SubscriptionAnalytics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  canceledSubscriptions: number;
  trialingSubscriptions: number;
  churnRate: string;
  trialConversionRate: string;
  planDistribution: Array<{
    plan: string;
    count: number;
    percentage: number;
  }>;
  averageSubscriptionDuration: number; // in days
  upgradeDowngradeTracking: {
    upgrades: number;
    downgrades: number;
  };
  cancellationReasons: Array<{
    reason: string;
    count: number;
  }>;
  retentionCohorts: Array<{
    cohort: string;
    retained: number;
    churned: number;
    retentionRate: string;
  }>;
  subscriptionsByStatus: {
    active: number;
    trialing: number;
    canceled: number;
    incomplete: number;
    past_due: number;
    unpaid: number;
  };
}

export async function getSubscriptionAnalytics(dateRange?: { start?: Date; end?: Date }): Promise<SubscriptionAnalytics> {
  const isRanged = Boolean(dateRange?.start && dateRange?.end);
  const start = isRanged ? dateRange!.start! : undefined;
  const end = isRanged ? dateRange!.end! : undefined;

  // Total subscriptions in context
  const totalSubscriptions = isRanged
    ? await prisma.subscription.count({
        where: {
          OR: [
            { createdAt: { gte: start, lte: end } },
            { updatedAt: { gte: start, lte: end } },
            { currentPeriodStart: { gte: start, lte: end } },
            { currentPeriodEnd: { gte: start, lte: end } },
            { canceledAt: { gte: start, lte: end } },
            { endedAt: { gte: start, lte: end } },
          ],
        },
      })
    : await prisma.subscription.count();

  // Subscriptions by status in context
  const statusCounts = isRanged
    ? await prisma.subscription.groupBy({
        by: ['status'],
        where: {
          OR: [
            { createdAt: { gte: start, lte: end } },
            { updatedAt: { gte: start, lte: end } },
            { currentPeriodStart: { gte: start, lte: end } },
            { currentPeriodEnd: { gte: start, lte: end } },
            { canceledAt: { gte: start, lte: end } },
            { endedAt: { gte: start, lte: end } },
          ],
        },
        _count: { status: true },
      })
    : await prisma.subscription.groupBy({ by: ['status'], _count: { status: true } });

  const subscriptionsByStatus = {
    active: statusCounts.find(s => s.status === 'active')?._count.status || 0,
    trialing: statusCounts.find(s => s.status === 'trialing')?._count.status || 0,
    canceled: statusCounts.find(s => s.status === 'canceled')?._count.status || 0,
    incomplete: statusCounts.find(s => s.status === 'incomplete')?._count.status || 0,
    past_due: statusCounts.find(s => s.status === 'past_due')?._count.status || 0,
    unpaid: statusCounts.find(s => s.status === 'unpaid')?._count.status || 0
  };

  const activeSubscriptions = subscriptionsByStatus.active;
  const canceledSubscriptions = subscriptionsByStatus.canceled;
  const trialingSubscriptions = subscriptionsByStatus.trialing;

  // Calculate churn rate in context
  const canceledInPeriod = isRanged
    ? await prisma.subscription.count({ where: { status: 'canceled', canceledAt: { gte: start, lte: end } } })
    : await prisma.subscription.count({ where: { status: 'canceled' } });
  const totalAtStartOfPeriod = totalSubscriptions + (isRanged ? canceledInPeriod : 0);
  const churnRate = totalAtStartOfPeriod > 0 ? ((canceledInPeriod / totalAtStartOfPeriod) * 100).toFixed(2) + '%' : '0.00%';

  // Trial conversion rate (trials that converted to active)
  const trialsStartedInPeriod = isRanged
    ? await prisma.subscription.count({ where: { createdAt: { gte: start, lte: end } } })
    : await prisma.subscription.count({ where: { status: 'trialing' } });

  const convertedTrials = isRanged
    ? await prisma.subscription.count({
        where: {
          status: 'active',
          trialStart: { not: null },
          trialEnd: { not: null },
          createdAt: { gte: start, lte: end },
        },
      })
    : await prisma.subscription.count({ where: { status: 'active', trialStart: { not: null } } });

  const trialConversionRate = trialsStartedInPeriod > 0
    ? ((convertedTrials / trialsStartedInPeriod) * 100).toFixed(2) + '%'
    : 'N/A';

  // Plan distribution (from metadata)
  const allSubscriptions = await prisma.subscription.findMany({
    where: isRanged
      ? {
          status: { in: ['active', 'trialing'] },
          currentPeriodStart: { lte: end },
          OR: [{ endedAt: null }, { endedAt: { gte: start } }],
        }
      : { status: { in: ['active', 'trialing'] } },
    select: { metadata: true },
  });

  const planMap = new Map<string, number>();
  allSubscriptions.forEach(sub => {
    const metadata = sub.metadata as any;
    const planName = metadata?.planName || metadata?.plan || 'Unknown Plan';
    planMap.set(planName, (planMap.get(planName) || 0) + 1);
  });

  const totalPlans = allSubscriptions.length;
  const planDistribution = Array.from(planMap.entries())
    .map(([plan, count]) => ({
      plan,
      count,
      percentage: totalPlans > 0 ? (count / totalPlans) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count);

  // Average subscription duration (for canceled subscriptions)
  const canceledSubs = await prisma.subscription.findMany({
    where: isRanged
      ? { status: 'canceled', canceledAt: { not: null, gte: start, lte: end } }
      : { status: 'canceled', canceledAt: { not: null } },
    select: {
      createdAt: true,
      canceledAt: true
    }
  });

  const durations = canceledSubs
    .filter(sub => sub.canceledAt)
    .map(sub => {
      const created = new Date(sub.createdAt).getTime();
      const canceled = new Date(sub.canceledAt!).getTime();
      return (canceled - created) / (1000 * 60 * 60 * 24); // days
    });

  const averageSubscriptionDuration = durations.length > 0
    ? durations.reduce((sum, d) => sum + d, 0) / durations.length
    : 0;

  // Upgrade/Downgrade tracking (from metadata changes)
  // This would typically require tracking subscription changes over time
  // For now, we'll use a simplified approach based on metadata
  const subscriptionsWithHistory = await prisma.subscription.findMany({
    where: isRanged ? { updatedAt: { gte: start, lte: end } } : {},
    select: { metadata: true, updatedAt: true },
  });

  let upgrades = 0;
  let downgrades = 0;
  subscriptionsWithHistory.forEach(sub => {
    const metadata = sub.metadata as any;
    if (metadata?.changeType === 'upgrade') upgrades++;
    if (metadata?.changeType === 'downgrade') downgrades++;
  });

  // Cancellation reasons (from metadata)
  const canceledWithReasons = await prisma.subscription.findMany({
    where: isRanged
      ? { status: 'canceled', canceledAt: { gte: start, lte: end } }
      : { status: 'canceled' },
    select: { metadata: true },
  });

  const reasonMap = new Map<string, number>();
  canceledWithReasons.forEach(sub => {
    const metadata = sub.metadata as any;
    const reason = metadata?.cancellationReason || 'Not specified';
    reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
  });

  const cancellationReasons = Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  // Retention cohorts (by month)
  const cohorts = [];
  const monthsToAnalyze = 6; // Last 6 months (static). Future: make range-aware if needed.
  
  for (let i = 0; i < monthsToAnalyze; i++) {
    const cohortStart = new Date();
    cohortStart.setMonth(cohortStart.getMonth() - i);
    cohortStart.setDate(1);
    
    const cohortEnd = new Date(cohortStart);
    cohortEnd.setMonth(cohortEnd.getMonth() + 1);

    const cohortSubscriptions = await prisma.subscription.findMany({
      where: {
        createdAt: { gte: cohortStart, lt: cohortEnd }
      },
      select: { id: true, status: true, canceledAt: true }
    });

    const total = cohortSubscriptions.length;
    const retained = cohortSubscriptions.filter(s => s.status === 'active' || s.status === 'trialing').length;
    const churned = cohortSubscriptions.filter(s => s.status === 'canceled').length;

    if (total > 0) {
      cohorts.push({
        cohort: cohortStart.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        retained,
        churned,
        retentionRate: ((retained / total) * 100).toFixed(2) + '%'
      });
    }
  }

  return {
    totalSubscriptions,
    activeSubscriptions,
    canceledSubscriptions,
    trialingSubscriptions,
    churnRate,
    trialConversionRate,
    planDistribution,
    averageSubscriptionDuration: parseFloat(averageSubscriptionDuration.toFixed(2)),
    upgradeDowngradeTracking: {
      upgrades,
      downgrades
    },
    cancellationReasons,
    retentionCohorts: cohorts,
    subscriptionsByStatus
  };
}

export const subscriptionAnalyticsDetails = `
Subscription Analytics (Enhanced) includes:
- Total Subscriptions: All subscriptions in the system
- Active Subscriptions: Currently active subscriptions
- Subscription Churn Rate: Percentage of subscriptions canceled in the period
- Trial Conversion Rate: Percentage of trials that converted to paid subscriptions
- Plan Distribution: Breakdown of subscriptions by plan/product
- Average Subscription Duration: Average lifetime of canceled subscriptions (in days)
- Upgrade/Downgrade Tracking: Number of plan upgrades and downgrades
- Cancellation Reasons: Top reasons for subscription cancellations (from metadata)
- Retention Cohorts: Monthly cohort analysis showing retention rates
- Subscriptions by Status: Breakdown by status (active, trialing, canceled, etc.)

These metrics help you optimize pricing, reduce churn, improve retention, and understand customer behavior.`;
