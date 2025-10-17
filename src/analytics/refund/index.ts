import { prisma } from '../../db/prisma';

/**
 * Refund Analytics Service
 * Provides comprehensive refund analytics
 */

export interface RefundAnalytics {
  totalRefunds: number;
  totalRefundAmount: number;
  refundRate: number; // Percentage of payments refunded
  averageRefundAmount: number;
  refundsByReason: Array<{
    reason: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
  refundsByCurrency: Array<{
    currency: string;
    count: number;
    amount: number;
  }>;
  refundTrends: Array<{
    date: string;
    count: number;
    amount: number;
  }>;
  topRefundedCustomers: Array<{
    customerId: string;
    customerEmail: string;
    customerName: string;
    refundCount: number;
    refundAmount: number;
  }>;
  refundsByStatus: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
}

export async function getRefundAnalytics(
  startDate?: Date,
  endDate?: Date
): Promise<RefundAnalytics> {
  const isRanged = Boolean(startDate && endDate);

  const whereClause: any = {};
  if (isRanged) {
    whereClause.refundedAt = { gte: startDate, lte: endDate };
  }

  // Get all refunds in the date range
  const allRefunds = await prisma.refund.findMany({
    where: whereClause,
  });

  // Get customer details for refunds
  const customerIds = [...new Set(allRefunds.map(r => r.stripeCustomerId))];
  const customers = await prisma.customer.findMany({
    where: {
      stripeCustomerId: { in: customerIds },
    },
  });
  const customerMap = new Map(customers.map(c => [c.stripeCustomerId, c]));

  // Calculate basic metrics
  const totalRefunds = allRefunds.length;
  const totalRefundAmount = allRefunds.reduce((sum, r) => sum + r.amount, 0);
  const averageRefundAmount = totalRefunds > 0 ? totalRefundAmount / totalRefunds : 0;

  // Calculate refund rate (need total payments in same period)
  const totalPayments = isRanged
    ? await prisma.payment.count({
        where: {
          status: { in: ['succeeded', 'paid'] },
          paidAt: { gte: startDate, lte: endDate },
        },
      })
    : await prisma.payment.count({
        where: { status: { in: ['succeeded', 'paid'] } },
      });
  
  const refundRate = totalPayments > 0 ? (totalRefunds / totalPayments) * 100 : 0;

  // Refunds by reason
  const reasonMap = new Map<string, { count: number; amount: number }>();
  allRefunds.forEach((refund) => {
    const reason = refund.reason || 'unspecified';
    const existing = reasonMap.get(reason) || { count: 0, amount: 0 };
    reasonMap.set(reason, {
      count: existing.count + 1,
      amount: existing.amount + refund.amount,
    });
  });

  const refundsByReason = Array.from(reasonMap.entries())
    .map(([reason, data]) => ({
      reason,
      count: data.count,
      amount: data.amount,
      percentage: totalRefunds > 0 ? (data.count / totalRefunds) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Refunds by currency
  const currencyMap = new Map<string, { count: number; amount: number }>();
  allRefunds.forEach((refund) => {
    const currency = refund.currency.toUpperCase();
    const existing = currencyMap.get(currency) || { count: 0, amount: 0 };
    currencyMap.set(currency, {
      count: existing.count + 1,
      amount: existing.amount + refund.amount,
    });
  });

  const refundsByCurrency = Array.from(currencyMap.entries())
    .map(([currency, data]) => ({
      currency,
      count: data.count,
      amount: data.amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Refund trends (daily)
  const trendMap = new Map<string, { count: number; amount: number }>();
  allRefunds.forEach((refund) => {
    if (!refund.refundedAt) return;
    const date = refund.refundedAt.toISOString().split('T')[0];
    const existing = trendMap.get(date) || { count: 0, amount: 0 };
    trendMap.set(date, {
      count: existing.count + 1,
      amount: existing.amount + refund.amount,
    });
  });

  const refundTrends = Array.from(trendMap.entries())
    .map(([date, data]) => ({
      date,
      count: data.count,
      amount: data.amount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top refunded customers
  const customerRefundMap = new Map<string, { count: number; amount: number }>();
  allRefunds.forEach((refund) => {
    const customerId = refund.stripeCustomerId;
    const existing = customerRefundMap.get(customerId) || { count: 0, amount: 0 };
    customerRefundMap.set(customerId, {
      count: existing.count + 1,
      amount: existing.amount + refund.amount,
    });
  });

  const topRefundedCustomers = Array.from(customerRefundMap.entries())
    .map(([customerId, data]) => {
      const customer = customerMap.get(customerId);
      return {
        customerId,
        customerEmail: customer?.email || 'N/A',
        customerName: customer?.name || 'N/A',
        refundCount: data.count,
        refundAmount: data.amount,
      };
    })
    .sort((a, b) => b.refundAmount - a.refundAmount)
    .slice(0, 10); // Top 10

  // Refunds by status
  const statusMap = new Map<string, { count: number; amount: number }>();
  allRefunds.forEach((refund) => {
    const status = refund.status;
    const existing = statusMap.get(status) || { count: 0, amount: 0 };
    statusMap.set(status, {
      count: existing.count + 1,
      amount: existing.amount + refund.amount,
    });
  });

  const refundsByStatus = Array.from(statusMap.entries())
    .map(([status, data]) => ({
      status,
      count: data.count,
      amount: data.amount,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalRefunds,
    totalRefundAmount,
    refundRate,
    averageRefundAmount,
    refundsByReason,
    refundsByCurrency,
    refundTrends,
    topRefundedCustomers,
    refundsByStatus,
  };
}
