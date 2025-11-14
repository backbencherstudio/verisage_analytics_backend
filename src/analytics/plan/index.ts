import { prisma } from '../../db/prisma';


export interface PlanAnalytics {
  totalPlans: number;
  activePlans: number;
  planPerformance: Array<{
    planId: string;
    planName: string;
    stripePriceId: string;
    amount: number;
    currency: string;
    interval: string;
    activeSubscriptions: number;
    totalRevenue: number;
    averageRevenuePerSubscription: number;
    churnRate: number;
  }>;
  popularPlans: Array<{
    planId: string;
    planName: string;
    subscriptionCount: number;
    revenue: number;
  }>;
  planDistribution: Array<{
    interval: string;
    planCount: number;
    subscriptionCount: number;
    percentage: number;
  }>;
  revenueByPlan: Array<{
    planId: string;
    planName: string;
    totalRevenue: number;
    percentage: number;
  }>;
  planUpgradeDowngrade: Array<{
    fromPlan: string;
    toPlan: string;
    count: number;
    type: 'upgrade' | 'downgrade' | 'plan_change';
  }>;
}

export async function getPlanAnalytics(
  startDate?: Date,
  endDate?: Date
): Promise<PlanAnalytics> {
  const allPrices = await prisma.price.findMany({
    include: {
      product: true,
    },
  });
  const totalPlans = allPrices.length;
  const activePlans = allPrices.filter(p => p.isActive).length;

  // Get all subscriptions
  const subscriptions = await prisma.subscription.findMany({
    include: {
      customer: true,
    },
  });

  // Get payments for revenue calculation with invoice relation
  const paymentWhereClause: any = {
    status: { in: ['succeeded', 'paid'] },
  };
  if (startDate || endDate) {
    paymentWhereClause.createdAt = {};
    if (startDate) paymentWhereClause.createdAt.gte = startDate;
    if (endDate) paymentWhereClause.createdAt.lte = endDate;
  }

  const payments = await prisma.payment.findMany({
    where: paymentWhereClause,
    include: {
      invoice: {
        select: {
          stripeSubscriptionId: true,
        },
      },
    },
  });

  // Map subscriptions to prices (using metadata or price info from subscriptions)
  const pricePlanMap = new Map<string, { subs: any[]; revenue: number }>();
  
  subscriptions.forEach((sub) => {
    const priceId = (sub.metadata as any)?.priceId || (sub.metadata as any)?.price || 'unknown';
    const existing = pricePlanMap.get(priceId) || { subs: [], revenue: 0 };
    existing.subs.push(sub);
    pricePlanMap.set(priceId, existing);
  });

  // Calculate revenue per subscription (approximate)
  const subscriptionRevenueMap = new Map<string, number>();
  payments.forEach((payment) => {
    const subId = payment.invoice?.stripeSubscriptionId;
    if (subId) {
      const existing = subscriptionRevenueMap.get(subId) || 0;
      subscriptionRevenueMap.set(subId, existing + payment.amount);
    }
  });

  // Calculate plan performance
  const planPerformance = allPrices.map((price) => {
    const planData = pricePlanMap.get(price.stripePriceId) || { subs: [], revenue: 0 };
    const activeSubscriptions = planData.subs.filter(s => s.status === 'active' || s.status === 'trialing').length;
    const canceledSubscriptions = planData.subs.filter(s => s.status === 'canceled').length;
    const totalSubscriptions = planData.subs.length;
    
    // Calculate total revenue for this plan's subscriptions
    let totalRevenue = 0;
    planData.subs.forEach((sub) => {
      totalRevenue += subscriptionRevenueMap.get(sub.stripeSubscriptionId) || 0;
    });

    const churnRate = totalSubscriptions > 0 ? (canceledSubscriptions / totalSubscriptions) * 100 : 0;
    const averageRevenuePerSubscription = activeSubscriptions > 0 ? totalRevenue / activeSubscriptions : 0;

    return {
      planId: price.id,
      planName: price.product.name,
      stripePriceId: price.stripePriceId,
      amount: price.unitAmount || 0,
      currency: price.currency,
      interval: price.recurringInterval || 'month',
      activeSubscriptions,
      totalRevenue,
      averageRevenuePerSubscription,
      churnRate,
    };
  });

  // Popular plans (by subscription count)
  const popularPlans = planPerformance
    .map((p) => ({
      planId: p.planId,
      planName: p.planName,
      subscriptionCount: p.activeSubscriptions,
      revenue: p.totalRevenue,
    }))
    .sort((a, b) => b.subscriptionCount - a.subscriptionCount)
    .slice(0, 10);

  // Plan distribution by interval
  const intervalMap = new Map<string, { planCount: number; subscriptionCount: number }>();
  planPerformance.forEach((p) => {
    const existing = intervalMap.get(p.interval) || { planCount: 0, subscriptionCount: 0 };
    intervalMap.set(p.interval, {
      planCount: existing.planCount + 1,
      subscriptionCount: existing.subscriptionCount + p.activeSubscriptions,
    });
  });

  const totalSubscriptions = planPerformance.reduce((sum, p) => sum + p.activeSubscriptions, 0);
  const planDistribution = Array.from(intervalMap.entries())
    .map(([interval, data]) => ({
      interval,
      planCount: data.planCount,
      subscriptionCount: data.subscriptionCount,
      percentage: totalSubscriptions > 0 ? (data.subscriptionCount / totalSubscriptions) * 100 : 0,
    }))
    .sort((a, b) => b.subscriptionCount - a.subscriptionCount);

  // Revenue by plan
  const totalRevenue = planPerformance.reduce((sum, p) => sum + p.totalRevenue, 0);
  const revenueByPlan = planPerformance
    .map((p) => ({
      planId: p.planId,
      planName: p.planName,
      totalRevenue: p.totalRevenue,
      percentage: totalRevenue > 0 ? (p.totalRevenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Plan upgrade/downgrade analysis
  const changeWhereClause: any = {};
  if (startDate || endDate) {
    changeWhereClause.effectiveDate = {};
    if (startDate) changeWhereClause.effectiveDate.gte = startDate;
    if (endDate) changeWhereClause.effectiveDate.lte = endDate;
  }

  const subscriptionChanges = await prisma.subscriptionChange.findMany({
    where: changeWhereClause,
  });

  // Get all unique price IDs from changes
  const priceIds = new Set<string>();
  subscriptionChanges.forEach(change => {
    if (change.fromPriceId) priceIds.add(change.fromPriceId);
    if (change.toPriceId) priceIds.add(change.toPriceId);
  });

  // Fetch price details
  const prices = await prisma.price.findMany({
    where: {
      stripePriceId: {
        in: Array.from(priceIds),
      },
    },
    include: {
      product: true,
    },
  });

  const priceMap = new Map(prices.map(p => [p.stripePriceId, p]));

  const changeMap = new Map<string, { count: number; type: 'upgrade' | 'downgrade' | 'plan_change' }>();
  subscriptionChanges.forEach((change) => {
    const fromPrice = change.fromPriceId ? priceMap.get(change.fromPriceId) : null;
    const toPrice = change.toPriceId ? priceMap.get(change.toPriceId) : null;
    const fromPriceName = fromPrice?.product.name || fromPrice?.nickname || change.fromPriceId || 'unknown';
    const toPriceName = toPrice?.product.name || toPrice?.nickname || change.toPriceId || 'unknown';
    const key = `${fromPriceName} → ${toPriceName}`;
    const existing = changeMap.get(key) || { count: 0, type: change.changeType as any };
    changeMap.set(key, {
      count: existing.count + 1,
      type: change.changeType as any,
    });
  });

  const planUpgradeDowngrade = Array.from(changeMap.entries())
    .map(([key, data]) => {
      const [fromPlan, toPlan] = key.split(' → ');
      return {
        fromPlan,
        toPlan,
        count: data.count,
        type: data.type,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    totalPlans,
    activePlans,
    planPerformance,
    popularPlans,
    planDistribution,
    revenueByPlan,
    planUpgradeDowngrade,
  };
}
