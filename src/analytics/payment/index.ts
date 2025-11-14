import { prisma } from '../../db/prisma';


export interface PaymentAnalytics {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  successRate: number;
  totalAmount: number;
  averagePaymentValue: number;
  paymentsByMethod: Array<{
    method: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
  paymentsByCurrency: Array<{
    currency: string;
    count: number;
    amount: number;
  }>;
  paymentTrends: Array<{
    date: string;
    successfulCount: number;
    failedCount: number;
    totalAmount: number;
  }>;
  topCustomers: Array<{
    customerId: string;
    customerEmail: string;
    customerName: string;
    totalPayments: number;
    totalAmount: number;
  }>;
}

export async function getPaymentAnalytics(
  startDate?: Date,
  endDate?: Date
): Promise<PaymentAnalytics> {
  const isRanged = Boolean(startDate && endDate);

  const whereClause: any = {};
  if (isRanged) {
    whereClause.paidAt = { gte: startDate, lte: endDate };
  }

  // Get payments in the context (use paidAt for successful, createdAt fallback for non-success)
  const allPayments = await prisma.payment.findMany({
    where: isRanged
      ? {
          OR: [
            { status: { in: ['succeeded', 'paid'] }, paidAt: { gte: startDate, lte: endDate } },
            { status: { in: ['failed', 'canceled'] }, createdAt: { gte: startDate, lte: endDate } },
          ],
        }
      : {},
    include: { customer: true },
  });

  // Calculate basic metrics
  const totalPayments = allPayments.length;
  const successfulPaymentList = allPayments.filter((p) => p.status === 'succeeded' || p.status === 'paid');
  const failedPaymentList = allPayments.filter((p) => p.status === 'failed' || p.status === 'canceled');

  const successfulPayments = successfulPaymentList.length;
  const failedPayments = failedPaymentList.length;
  const successRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0;

  // Calculate total amount (only successful payments)
  const totalAmount = successfulPaymentList.reduce((sum, p) => sum + p.amount, 0);
  const averagePaymentValue = successfulPayments > 0 ? totalAmount / successfulPayments : 0;

  // Payments by method (successful only)
  const paymentMethodMap = new Map<string, { count: number; amount: number }>();
  successfulPaymentList.forEach((payment) => {
    const method = (payment.metadata as any)?.paymentMethod || payment.paymentMethod || 'card';
    const existing = paymentMethodMap.get(method) || { count: 0, amount: 0 };
    paymentMethodMap.set(method, { count: existing.count + 1, amount: existing.amount + payment.amount });
  });

  const paymentsByMethod = Array.from(paymentMethodMap.entries())
    .map(([method, data]) => ({ method, count: data.count, amount: data.amount, percentage: totalPayments > 0 ? (data.count / totalPayments) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);

  // Payments by currency (successful only)
  const currencyMap = new Map<string, { count: number; amount: number }>();
  successfulPaymentList.forEach((payment) => {
    const currency = payment.currency.toUpperCase();
    const existing = currencyMap.get(currency) || { count: 0, amount: 0 };
    currencyMap.set(currency, { count: existing.count + 1, amount: existing.amount + payment.amount });
  });

  const paymentsByCurrency = Array.from(currencyMap.entries())
    .map(([currency, data]) => ({ currency, count: data.count, amount: data.amount }))
    .sort((a, b) => b.amount - a.amount);

  // Payment trends (by day) based on createdAt for failures and paidAt for successes
  const trendMap = new Map<string, { successful: number; failed: number; amount: number }>();
  allPayments.forEach((payment) => {
    const date = (payment.status === 'succeeded' || payment.status === 'paid') && payment.paidAt
      ? payment.paidAt.toISOString().split('T')[0]
      : payment.createdAt.toISOString().split('T')[0];
    const existing = trendMap.get(date) || { successful: 0, failed: 0, amount: 0 };

    if (payment.status === 'succeeded' || payment.status === 'paid') {
      existing.successful++;
      existing.amount += payment.amount;
    } else if (payment.status === 'failed' || payment.status === 'canceled') {
      existing.failed++;
    }

    trendMap.set(date, existing);
  });

  const paymentTrends = Array.from(trendMap.entries())
    .map(([date, data]) => ({ date, successfulCount: data.successful, failedCount: data.failed, totalAmount: data.amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top customers by payment amount (successful only)
  const customerMap = new Map<string, { count: number; amount: number; email: string; name: string }>();
  successfulPaymentList.forEach((payment) => {
    if (!payment.stripeCustomerId) return;
    const existing = customerMap.get(payment.stripeCustomerId) || {
      count: 0,
      amount: 0,
      email: payment.customer?.email || 'N/A',
      name: payment.customer?.name || 'N/A',
    };
    customerMap.set(payment.stripeCustomerId, { count: existing.count + 1, amount: existing.amount + payment.amount, email: existing.email, name: existing.name });
  });

  const topCustomers = Array.from(customerMap.entries())
    .map(([customerId, data]) => ({ customerId, customerEmail: data.email, customerName: data.name, totalPayments: data.count, totalAmount: data.amount }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10);

  return {
    totalPayments,
    successfulPayments,
    failedPayments,
    successRate,
    totalAmount,
    averagePaymentValue,
    paymentsByMethod,
    paymentsByCurrency,
    paymentTrends,
    topCustomers,
  };
}
