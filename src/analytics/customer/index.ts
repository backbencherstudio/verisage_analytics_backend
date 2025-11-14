import { prisma } from '../../db/prisma';


export async function getCustomerAnalytics(dateRange?: { start?: Date; end?: Date }) {
  // Total customers (all-time)
  const totalCustomers = await prisma.customer.count();

  let start: Date | undefined;
  let end: Date | undefined;

  const isRanged = Boolean(dateRange?.start && dateRange?.end);
  if (isRanged) {
    start = dateRange!.start!;
    end = dateRange!.end!;
  }

  // Helper where for subscription overlap with range
  const subscriptionRangeWhere = isRanged
    ? {
        OR: [
          { createdAt: { gte: start, lte: end } },
          { currentPeriodStart: { gte: start, lte: end } },
          { currentPeriodEnd: { gte: start, lte: end } },
          { canceledAt: { gte: start, lte: end } },
          { endedAt: { gte: start, lte: end } },
        ],
      }
    : undefined;

  // Total customers in context
  const totalCustomersContext = isRanged
    ? await prisma.customer.count({
        where: {
          OR: [
            { createdAt: { gte: start, lte: end } },
            { payments: { some: { status: { in: ['paid', 'succeeded'] }, paidAt: { gte: start, lte: end } } } },
            { subscriptions: { some: subscriptionRangeWhere as any } },
          ],
        },
      })
    : totalCustomers;

  // New customers
  const newCustomers = isRanged
    ? await prisma.customer.count({ where: { createdAt: { gte: start, lte: end } } })
    : totalCustomers;

  // Churn
  const churnedCustomers = isRanged
    ? await prisma.customer.count({
        where: {
          subscriptions: {
            some: { status: 'canceled', canceledAt: { gte: start, lte: end } },
          },
        },
      })
    : await prisma.customer.count({
        where: { subscriptions: { every: { status: 'canceled' } } },
      });
  const churnRate = totalCustomersContext > 0 ? (churnedCustomers / totalCustomersContext) * 100 : 0;

  // Active customers in context
  const activeCustomers = isRanged
    ? await prisma.customer.count({
        where: {
          subscriptions: {
            some: {
              status: { in: ['active', 'trialing'] },
              currentPeriodStart: { lte: end },
              OR: [{ endedAt: null }, { endedAt: { gte: start } }],
            },
          },
        },
      })
    : await prisma.customer.count({ where: { subscriptions: { some: { status: { in: ['active', 'trialing'] } } } } });

  const inactiveCustomers = totalCustomersContext - activeCustomers;

  // Multi-subscription customers in context (>= 2 subs in range)
  const customersWithSubscriptions = isRanged
    ? await prisma.customer.findMany({
        where: { subscriptions: { some: subscriptionRangeWhere as any } },
        select: {
          id: true,
          email: true,
          name: true,
          subscriptions: { where: subscriptionRangeWhere as any, select: { id: true } },
        },
      })
    : await prisma.customer.findMany({
        where: { subscriptions: { some: {} } },
        select: { id: true, email: true, name: true, subscriptions: { select: { id: true } } },
      });

  const multiSubscriptionCustomers = customersWithSubscriptions
    .map((c) => ({ id: c.id, email: c.email, name: c.name, subscriptionCount: c.subscriptions.length }))
    .filter((c) => c.subscriptionCount > 1)
    .sort((a, b) => b.subscriptionCount - a.subscriptionCount)
    .slice(0, 10);

  // Customer lifetime value within context
  const customersWithRevenue = await prisma.customer.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      payments: {
        where: isRanged
          ? { status: { in: ['paid', 'succeeded'] }, paidAt: { gte: start, lte: end } }
          : { status: { in: ['paid', 'succeeded'] } },
        select: { amount: true, currency: true },
      },
    },
  });

  const customerLTV = customersWithRevenue
    .map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      totalRevenue: c.payments.reduce((sum, p) => sum + p.amount, 0) / 100,
      currency: c.payments[0]?.currency || 'usd',
    }))
    .filter((c) => c.totalRevenue > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10);

  const avgCLV = customerLTV.length > 0 ? customerLTV.reduce((sum, c) => sum + c.totalRevenue, 0) / customerLTV.length : 0;

  return {
    totalCustomers: totalCustomersContext,
    newCustomers,
    churnRate: churnRate.toFixed(2) + '%',
    customerLifetimeValue: { average: avgCLV.toFixed(2), topCustomers: customerLTV },
    customerAcquisitionCost: null,
    activeCustomers,
    inactiveCustomers,
    customersByCountry: 'Not available (country field not in schema)',
    multiSubscriptionCustomers,
  };
}

