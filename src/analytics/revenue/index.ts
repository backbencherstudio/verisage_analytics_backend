// Revenue Analytics Service
// Provides: MRR, ARR, revenue by plan, revenue by subscription type, growth rate, ARPU, net revenue, revenue by currency, upcoming revenue

import { prisma } from '../../db/prisma';

interface RevenueAnalytics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  totalRevenue: number;
  netRevenue: number; // After refunds
  averageRevenuePerUser: number;
  revenueGrowth: {
    monthOverMonth: string;
    yearOverYear: string;
  };
  revenueByPlan: Array<{
    plan: string;
    revenue: number;
    percentage: number;
  }>;
  revenueBySubscriptionType: {
    monthly: number;
    yearly: number;
    other: number;
  };
  revenueByCurrency: Array<{
    currency: string;
    revenue: number;
  }>;
  upcomingRevenue: number; // From active subscriptions next billing cycle
}

export async function getRevenueAnalytics(dateRange?: { start?: Date; end?: Date }): Promise<RevenueAnalytics> {
  const isRanged = Boolean(dateRange?.start && dateRange?.end);
  const start = isRanged ? dateRange!.start! : undefined;
  const end = isRanged ? dateRange!.end! : undefined;

  // Get all successful payments in the date range with invoice relation
  const payments = await prisma.payment.findMany({
    where: {
      status: { in: ['paid', 'succeeded'] },
      ...(isRanged ? { paidAt: { gte: start, lte: end } } : {}),
    },
    select: {
      amount: true,
      currency: true,
      paidAt: true,
      invoice: {
        select: {
          stripeSubscriptionId: true
        }
      }
    }
  });

  // Calculate total revenue
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0) / 100;

  // Get refunds (if you track them separately, for now we'll use negative amounts or a refund status)
  // Assuming refunds might be tracked in payments with negative amounts or specific status
  const refunds = await prisma.payment.findMany({
    where: {
      status: 'refunded',
      ...(isRanged ? { paidAt: { gte: start, lte: end } } : {}),
    },
    select: { amount: true }
  });
  const totalRefunds = refunds.reduce((sum, r) => sum + Math.abs(r.amount), 0) / 100;
  const netRevenue = totalRevenue - totalRefunds;

  // Calculate MRR (Monthly Recurring Revenue) from active subscriptions
  const activeSubscriptions = await prisma.subscription.findMany({
    where: isRanged
      ? {
          status: { in: ['active', 'trialing'] },
          currentPeriodStart: { lte: end },
          OR: [{ endedAt: null }, { endedAt: { gte: start } }],
        }
      : { status: { in: ['active', 'trialing'] } },
    select: {
      stripeSubscriptionId: true,
      metadata: true
    }
  });

  // Calculate MRR by getting monthly payment amounts
  // Note: In a real scenario, you'd get this from Stripe's subscription.items.price.recurring.interval
  // For now, we'll estimate from recent payments
  let mrr = 0;
  const subscriptionRevenue = new Map<string, number>();
  
  for (const payment of payments) {
    const subscriptionId = payment.invoice?.stripeSubscriptionId;
    if (subscriptionId) {
      const current = subscriptionRevenue.get(subscriptionId) || 0;
      subscriptionRevenue.set(subscriptionId, current + payment.amount);
    }
  }

  // Estimate MRR (this is a simplified calculation)
  // In production, you'd want to fetch actual subscription intervals from Stripe
  const avgMonthlyRevenue = payments.length > 0 
    ? (payments.reduce((sum, p) => sum + p.amount, 0) / payments.length) / 100
    : 0;
  mrr = avgMonthlyRevenue * activeSubscriptions.length;

  // ARR = MRR * 12
  const arr = mrr * 12;

  // Revenue by currency
  const currencyMap = new Map<string, number>();
  payments.forEach(p => {
    const current = currencyMap.get(p.currency.toUpperCase()) || 0;
    currencyMap.set(p.currency.toUpperCase(), current + p.amount);
  });
  const revenueByCurrency = Array.from(currencyMap.entries()).map(([currency, amount]) => ({
    currency,
    revenue: amount / 100
  }));

  // Revenue by plan (from subscription metadata)
  const planMap = new Map<string, number>();
  const subscriptionPayments = await prisma.payment.findMany({
    where: {
      status: { in: ['paid', 'succeeded'] },
      ...(isRanged ? { paidAt: { gte: start, lte: end } } : {}),
    },
    select: {
      amount: true,
      invoice: {
        select: {
          stripeSubscriptionId: true
        }
      }
    }
  }).then(payments => payments.filter(p => p.invoice?.stripeSubscriptionId !== null));

  const subscriptionsData = await prisma.subscription.findMany({
    where: {
      stripeSubscriptionId: {
        in: subscriptionPayments
          .map(p => p.invoice?.stripeSubscriptionId)
          .filter((id): id is string => id !== null && id !== undefined)
      }
    },
    select: {
      stripeSubscriptionId: true,
      metadata: true
    }
  });

  // Map subscription IDs to plan names
  const subscriptionPlanMap = new Map<string, string>();
  subscriptionsData.forEach(sub => {
    const metadata = sub.metadata as any;
    const planName = metadata?.planName || metadata?.plan || 'Unknown Plan';
    subscriptionPlanMap.set(sub.stripeSubscriptionId, planName);
  });

  subscriptionPayments.forEach(p => {
    const subscriptionId = p.invoice?.stripeSubscriptionId;
    if (subscriptionId) {
      const planName = subscriptionPlanMap.get(subscriptionId) || 'Unknown Plan';
      const current = planMap.get(planName) || 0;
      planMap.set(planName, current + p.amount);
    }
  });

  const totalPlanRevenue = Array.from(planMap.values()).reduce((sum, amt) => sum + amt, 0);
  const revenueByPlan = Array.from(planMap.entries()).map(([plan, amount]) => ({
    plan,
    revenue: amount / 100,
    percentage: totalPlanRevenue > 0 ? (amount / totalPlanRevenue) * 100 : 0
  }));

  // Revenue by subscription type (monthly vs yearly)
  // This would typically come from Stripe subscription interval data
  // For now, we'll use a simplified approach based on payment amounts
  const monthlyThreshold = 50; // Payments under $50 likely monthly
  const revenueBySubscriptionType = {
    monthly: payments.filter(p => (p.amount / 100) < monthlyThreshold).reduce((sum, p) => sum + p.amount, 0) / 100,
    yearly: payments.filter(p => (p.amount / 100) >= monthlyThreshold).reduce((sum, p) => sum + p.amount, 0) / 100,
    other: 0
  };

  // Calculate ARPU (Average Revenue Per User)
  const totalCustomers = isRanged
    ? await prisma.customer.count({
        where: {
          OR: [
            { createdAt: { gte: start, lte: end } },
            { payments: { some: { status: { in: ['paid', 'succeeded'] }, paidAt: { gte: start, lte: end } } } },
            { subscriptions: { some: {
                OR: [
                  { createdAt: { gte: start, lte: end } },
                  { currentPeriodStart: { gte: start, lte: end } },
                  { currentPeriodEnd: { gte: start, lte: end } },
                  { canceledAt: { gte: start, lte: end } },
                  { endedAt: { gte: start, lte: end } },
                ]
            } } },
          ],
        },
      })
    : await prisma.customer.count();
  const averageRevenuePerUser = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  // Calculate revenue growth (Month over Month and Year over Year)
  let monthOverMonth = 'N/A';
  if (isRanged) {
    const previousMonthStart = new Date(start!);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
    const previousMonthPayments = await prisma.payment.findMany({
      where: {
        status: { in: ['paid', 'succeeded'] },
        paidAt: { gte: previousMonthStart, lt: start }
      },
      select: { amount: true }
    });
    const previousMonthRevenue = previousMonthPayments.reduce((sum, p) => sum + p.amount, 0) / 100;
    monthOverMonth = previousMonthRevenue > 0
      ? (((totalRevenue - previousMonthRevenue) / previousMonthRevenue) * 100).toFixed(2) + '%'
      : 'N/A';
  }

  let yearOverYear = 'N/A';
  if (isRanged) {
    const previousYearStart = new Date(start!);
    previousYearStart.setFullYear(previousYearStart.getFullYear() - 1);
    const previousYearEnd = new Date(end!);
    previousYearEnd.setFullYear(previousYearEnd.getFullYear() - 1);
    const previousYearPayments = await prisma.payment.findMany({
      where: {
        status: { in: ['paid', 'succeeded'] },
        paidAt: { gte: previousYearStart, lt: previousYearEnd }
      },
      select: { amount: true }
    });
    const previousYearRevenue = previousYearPayments.reduce((sum, p) => sum + p.amount, 0) / 100;
    yearOverYear = previousYearRevenue > 0
      ? (((totalRevenue - previousYearRevenue) / previousYearRevenue) * 100).toFixed(2) + '%'
      : 'N/A';
  }

  // Upcoming revenue (from active subscriptions - estimated next month)
  const upcomingRevenue = mrr; // Next month's expected MRR

  return {
    mrr: parseFloat(mrr.toFixed(2)),
    arr: parseFloat(arr.toFixed(2)),
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    netRevenue: parseFloat(netRevenue.toFixed(2)),
    averageRevenuePerUser: parseFloat(averageRevenuePerUser.toFixed(2)),
    revenueGrowth: {
      monthOverMonth,
      yearOverYear
    },
    revenueByPlan: revenueByPlan.sort((a, b) => b.revenue - a.revenue),
    revenueBySubscriptionType,
    revenueByCurrency,
    upcomingRevenue: parseFloat(upcomingRevenue.toFixed(2))
  };
}

export const revenueAnalyticsDetails = `
Revenue Analytics (Enhanced) includes:
- MRR (Monthly Recurring Revenue): Predictable monthly revenue from active subscriptions
- ARR (Annual Recurring Revenue): MRR * 12, representing yearly recurring revenue
- Total Revenue: All successful payments in the date range
- Net Revenue: Total revenue minus refunds
- ARPU (Average Revenue Per User): Total revenue divided by total customers
- Revenue Growth: Month-over-Month and Year-over-Year growth percentages
- Revenue by Plan/Product: Breakdown of revenue by subscription plan
- Revenue by Subscription Type: Monthly vs Yearly subscriptions
- Revenue by Currency: Multi-currency revenue breakdown
- Upcoming Revenue: Expected revenue from active subscriptions next billing cycle

These metrics help you understand revenue trends, forecast future income, and optimize pricing strategies.`;
