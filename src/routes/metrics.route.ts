
import { Router, Request, Response } from 'express';
import { getStripeMetrics, getSubscriptionStats, getStripeLiveMetrics } from '../services/stripe.service';
import { getGA4Metrics } from '../services/ga4.service';
import { syncGA4Data } from '../services/ga4.service';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// GET /api/metrics - Basic metrics health/status summary
router.get('/', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'Metrics endpoint is available.',
      endpoints: ['/api/metrics/stripe', '/api/metrics/stripe/stats', '/api/metrics/ga4'],
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Apply auth middleware to all routes in this router
router.use(authMiddleware);

// Get Stripe subscription metrics
router.get('/stripe', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const metrics = await getStripeMetrics({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error('Error fetching Stripe metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get subscription statistics
router.get('/stripe/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getSubscriptionStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error fetching subscription stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get GA4 analytics metrics
router.get('/ga4', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const metrics = await getGA4Metrics({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error('Error fetching GA4 metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Trigger GA4 sync (pull fresh data from GA4 and store in DB)
router.post('/ga4/sync', async (_req: Request, res: Response) => {
  try {
    await syncGA4Data();
    res.json({ success: true, message: 'GA4 data synced successfully' });
  } catch (error: any) {
    console.error('Error syncing GA4 data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get combined dashboard data
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const range = {
      start: startDate ? new Date(startDate as string) : undefined,
      end: endDate ? new Date(endDate as string) : undefined,
    };

    // Import analytics services
    const {
      getCustomerAnalytics
    } = require('../analytics/customer/index');
    const {
      getSubscriptionAnalytics
    } = require('../analytics/subscription/index');
    const {
      getRevenueAnalytics
    } = require('../analytics/revenue/index');
    const {
      getPaymentAnalytics
    } = require('../analytics/payment/index');
    const {
      getRefundAnalytics
    } = require('../analytics/refund/index');
    const {
      getPlanAnalytics
    } = require('../analytics/plan/index');

    // Fetch all key metrics in parallel
    const [
      customer,
      subscription,
      revenue,
      payment,
      refund,
      plan,
      ga4,
      stripe
    ] = await Promise.all([
      getCustomerAnalytics(range),
      getSubscriptionAnalytics(range),
      getRevenueAnalytics(range),
      getPaymentAnalytics(range.start, range.end),
      getRefundAnalytics(range.start, range.end),
      getPlanAnalytics(range.start, range.end),
      getGA4Metrics({ startDate: range.start, endDate: range.end }),
      getStripeMetrics({ startDate: range.start, endDate: range.end })
    ]);

    // Compose dashboard summary
    const dashboard = {
      generatedAt: new Date().toISOString(),
      customers: {
        total: customer.totalCustomers,
        new: customer.newCustomers,
        churnRate: customer.churnRate,
        active: customer.activeCustomers,
        inactive: customer.inactiveCustomers,
        topLTV: customer.customerLifetimeValue?.topCustomers,
        multiSubscription: customer.multiSubscriptionCustomers,
      },
      subscriptions: {
        total: subscription.totalSubscriptions,
        active: subscription.activeSubscriptions,
        trialing: subscription.trialingSubscriptions,
        canceled: subscription.canceledSubscriptions,
        churnRate: subscription.churnRate,
        trialConversionRate: subscription.trialConversionRate,
        planDistribution: subscription.planDistribution,
        avgDuration: subscription.averageSubscriptionDuration,
        upgrades: subscription.upgradeDowngradeTracking?.upgrades,
        downgrades: subscription.upgradeDowngradeTracking?.downgrades,
        retentionCohorts: subscription.retentionCohorts,
      },
      revenue: {
        mrr: revenue.mrr,
        arr: revenue.arr,
        total: revenue.totalRevenue,
        net: revenue.netRevenue,
        arpu: revenue.averageRevenuePerUser,
        growth: revenue.revenueGrowth,
        byPlan: revenue.revenueByPlan,
        byCurrency: revenue.revenueByCurrency,
        upcoming: revenue.upcomingRevenue,
      },
      payments: {
        total: payment.totalPayments,
        successful: payment.successfulPayments,
        failed: payment.failedPayments,
        successRate: payment.successRate,
        totalAmount: payment.totalAmount,
        average: payment.averagePaymentValue,
        byMethod: payment.paymentsByMethod,
        byCurrency: payment.paymentsByCurrency,
        topCustomers: payment.topCustomers,
      },
      refunds: {
        total: refund.totalRefunds,
        amount: refund.totalRefundAmount,
        rate: refund.refundRate,
        average: refund.averageRefundAmount,
        byReason: refund.refundsByReason,
        byCurrency: refund.refundsByCurrency,
        topCustomers: refund.topRefundedCustomers,
      },
      plans: {
        total: plan.totalPlans,
        active: plan.activePlans,
        performance: plan.planPerformance,
        popular: plan.popularPlans,
        distribution: plan.planDistribution,
        revenueByPlan: plan.revenueByPlan,
        upgradeDowngrade: plan.planUpgradeDowngrade,
      },
      ga4: ga4?.summary,
      stripe: {
        totalSubscriptions: stripe.totalSubscriptions,
        activeSubscriptions: stripe.activeSubscriptions,
        totalPayments: stripe.totalPayments,
        successfulPayments: stripe.successfulPayments,
        failedPayments: stripe.failedPayments,
        totalRevenue: stripe.totalRevenue,
      },
    };

    res.json({ success: true, data: dashboard });
  } catch (error: any) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


// Live Stripe metrics (direct from Stripe, no DB writes)
router.get('/stripe/live', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const metrics = await getStripeLiveMetrics({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });
    
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    console.error('Error fetching live Stripe metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint to check database contents
router.get('/stripe/debug', async (req: Request, res: Response) => {
  try {
    const { prisma } = require('../db/prisma');
    
    const [
      samplePayments,
      paymentStatuses,
      sampleSubscriptions,
    ] = await Promise.all([
      prisma.payment.findMany({ take: 5, select: { status: true, amount: true, paidAt: true, createdAt: true } }),
      prisma.payment.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.subscription.findMany({ take: 5, select: { status: true, metadata: true } }),
    ]);
    
    res.json({
      success: true,
      data: {
        samplePayments,
        paymentStatusBreakdown: paymentStatuses,
        sampleSubscriptions,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;