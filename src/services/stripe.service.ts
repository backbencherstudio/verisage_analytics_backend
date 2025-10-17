import Stripe from 'stripe';
import { config } from '../config/env';
import { prisma } from '../db/prisma';
import { normalizeStripeEvent } from '../utils/normalizers';

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2024-06-20',
});

/**
 * Handle incoming Stripe webhook events
 */
export const handleStripeWebhook = async (event: Stripe.Event) => {
  console.log(`Processing Stripe event: ${event.type}`);

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionChange(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
};

/**
 * Handle subscription creation or update
 */
const handleSubscriptionChange = async (subscription: Stripe.Subscription) => {
  const normalized = normalizeStripeEvent(subscription);

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    update: {
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      metadata: normalized,
    },
    create: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      metadata: normalized,
    },
  });
};

/**
 * Handle subscription deletion
 */
const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: 'canceled',
      canceledAt: new Date(),
    },
  });
};

/**
 * Handle successful payment
 */
const handlePaymentSucceeded = async (invoice: Stripe.Invoice) => {
  // First, create or update the invoice record
  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    update: {
      stripeCustomerId: invoice.customer as string,
      stripeSubscriptionId: invoice.subscription as string | null,
      number: invoice.number || null,
      status: invoice.status || 'draft',
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      amountRemaining: invoice.amount_remaining,
      subtotal: invoice.subtotal,
      total: invoice.total,
      tax: invoice.tax || null,
      currency: invoice.currency,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      paidAt: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
      metadata: invoice as any,
    },
    create: {
      stripeInvoiceId: invoice.id,
      stripeCustomerId: invoice.customer as string,
      stripeSubscriptionId: invoice.subscription as string | null,
      number: invoice.number || null,
      status: invoice.status || 'draft',
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      amountRemaining: invoice.amount_remaining,
      subtotal: invoice.subtotal,
      total: invoice.total,
      tax: invoice.tax || null,
      currency: invoice.currency,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      paidAt: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
      metadata: invoice as any,
    },
  });

  // Then, create the payment record if there's a payment intent
  if (invoice.payment_intent) {
    await prisma.payment.upsert({
      where: { stripePaymentIntentId: invoice.payment_intent as string },
      update: {
        stripeCustomerId: invoice.customer as string,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'succeeded',
        paidAt: new Date(invoice.status_transitions.paid_at! * 1000),
        metadata: invoice as any,
      },
      create: {
        stripePaymentIntentId: invoice.payment_intent as string,
        stripeCustomerId: invoice.customer as string,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'succeeded',
        paidAt: new Date(invoice.status_transitions.paid_at! * 1000),
        metadata: invoice as any,
      },
    });
  }
};

/**
 * Handle failed payment
 */
const handlePaymentFailed = async (invoice: Stripe.Invoice) => {
  // First, create or update the invoice record
  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    update: {
      stripeCustomerId: invoice.customer as string,
      stripeSubscriptionId: invoice.subscription as string | null,
      number: invoice.number || null,
      status: invoice.status || 'open',
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      amountRemaining: invoice.amount_remaining,
      subtotal: invoice.subtotal,
      total: invoice.total,
      tax: invoice.tax || null,
      currency: invoice.currency,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      metadata: invoice as any,
    },
    create: {
      stripeInvoiceId: invoice.id,
      stripeCustomerId: invoice.customer as string,
      stripeSubscriptionId: invoice.subscription as string | null,
      number: invoice.number || null,
      status: invoice.status || 'open',
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      amountRemaining: invoice.amount_remaining,
      subtotal: invoice.subtotal,
      total: invoice.total,
      tax: invoice.tax || null,
      currency: invoice.currency,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      metadata: invoice as any,
    },
  });

  // Create payment record if there's a payment intent
  if (invoice.payment_intent) {
    await prisma.payment.create({
      data: {
        stripePaymentIntentId: invoice.payment_intent as string,
        stripeCustomerId: invoice.customer as string,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: 'failed',
        metadata: invoice as any,
      },
    });
  }
};

/**
 * Get Stripe metrics for dashboard
 */
export const getStripeMetrics = async (filter?: {
  startDate?: Date;
  endDate?: Date;
}) => {
  const where: any = {};

  if (filter?.startDate || filter?.endDate) {
    where.createdAt = {};
    if (filter.startDate) where.createdAt.gte = filter.startDate;
    if (filter.endDate) where.createdAt.lte = filter.endDate;
  }

  const [subscriptions, payments, totalRevenue] = await Promise.all([
    prisma.subscription.findMany({ where }),
    prisma.payment.findMany({ where }),
    prisma.payment.aggregate({
      where: { ...where, status: 'succeeded' },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalSubscriptions: subscriptions.length,
    activeSubscriptions: subscriptions.filter((s) => s.status === 'active').length,
    totalPayments: payments.length,
    successfulPayments: payments.filter((p) => p.status === 'succeeded').length,
    failedPayments: payments.filter((p) => p.status === 'failed').length,
    totalRevenue: totalRevenue._sum.amount || 0,
    subscriptions,
    payments,
  };
};

/**
 * Get subscription statistics
 */
export const getSubscriptionStats = async () => {
  const stats = await prisma.subscription.groupBy({
    by: ['status'],
    _count: true,
  });

  return stats.map((stat) => ({
    status: stat.status,
    count: stat._count,
  }));
};

/**
 * Get live Stripe metrics directly from Stripe API (no database writes)
 * Accepts optional date range filters and aggregates key KPIs.
 */
/**
 * Get Stripe metrics from DATABASE (fast, cached)
 * This is much faster than hitting Stripe API live
 */
export const getStripeLiveMetrics = async (filter?: {
  startDate?: Date;
  endDate?: Date;
}) => {
  // Build filter for database query
  const whereSubscription: any = {};
  const wherePayment: any = {};

  if (filter?.startDate || filter?.endDate) {
    whereSubscription.createdAt = {};
    wherePayment.createdAt = {};
    if (filter.startDate) {
      whereSubscription.createdAt.gte = filter.startDate;
      wherePayment.createdAt.gte = filter.startDate;
    }
    if (filter.endDate) {
      whereSubscription.createdAt.lte = filter.endDate;
      wherePayment.createdAt.lte = filter.endDate;
    }
  }

  // Fetch from database in parallel (much faster than Stripe API)
  const [
    allSubscriptions,
    activeSubscriptions,
    canceledSubscriptions,
    scheduledToCancelSubscriptions,
    allPayments,
    allPaymentData,
  ] = await Promise.all([
    prisma.subscription.count({ where: whereSubscription }),
    prisma.subscription.count({ 
      where: { ...whereSubscription, status: { in: ['active', 'trialing'] } } 
    }),
    prisma.subscription.count({ 
      where: { ...whereSubscription, status: 'canceled' } 
    }),
    prisma.subscription.count({ 
      where: { ...whereSubscription, cancelAtPeriodEnd: true } 
    }),
    prisma.payment.count({ where: wherePayment }),
    prisma.payment.findMany({ 
      where: wherePayment,
      select: { amount: true, currency: true, status: true, paidAt: true }
    }),
  ]);

  // Calculate metrics from all payment data
  // Note: Stripe invoices use 'paid' status, while payment intents use 'succeeded'
  const successfulPayments = allPaymentData.filter(p => 
    p.status === 'succeeded' || p.status === 'paid'
  );
  const failedPayments = allPaymentData.filter(p => 
    p.status === 'failed' || p.status === 'canceled' || p.status === 'uncollectible'
  );
  const totalRevenueCents = successfulPayments.reduce((sum, p) => sum + p.amount, 0);

  // Calculate MRR from active subscriptions
  // Get all active subscriptions with metadata to extract pricing info
  const activeSubsWithMetadata = await prisma.subscription.findMany({
    where: { 
      ...whereSubscription, 
      status: { in: ['active', 'trialing'] } 
    },
    select: { metadata: true }
  });

  // Try to calculate MRR from subscription metadata
  let mrrCents = 0;
  for (const sub of activeSubsWithMetadata) {
    const metadata = sub.metadata as any;
    // Try to extract price from metadata
    if (metadata?.items?.data) {
      for (const item of metadata.items.data) {
        const price = item.price;
        if (price?.unit_amount && price?.recurring) {
          const unit = price.unit_amount;
          const qty = item.quantity || 1;
          const interval = price.recurring.interval || 'month';
          const intervalCount = price.recurring.interval_count || 1;

          // Normalize to monthly
          let monthlyFactor = 1;
          if (interval === 'year') monthlyFactor = 1 / 12 / intervalCount;
          else if (interval === 'week') monthlyFactor = (52 / 12) / intervalCount;
          else if (interval === 'day') monthlyFactor = (365 / 12) / intervalCount;
          else monthlyFactor = 1 / intervalCount;

          mrrCents += unit * qty * monthlyFactor;
        }
      }
    }
  }

  const arrCents = mrrCents * 12;

  return {
    range: {
      startDate: filter?.startDate?.toISOString() || null,
      endDate: filter?.endDate?.toISOString() || null,
    },
    subscriptions: {
      total: allSubscriptions,
      active: activeSubscriptions,
      canceled: canceledSubscriptions,
      scheduledToCancel: scheduledToCancelSubscriptions,
      mrr: Math.round(mrrCents) / 100,
      arr: Math.round(arrCents) / 100,
    },
    invoices: {
      total: allPayments,
      paid: successfulPayments.length,
      failed: failedPayments.length,
      revenue: totalRevenueCents / 100,
    },
    refunds: {
      total: 0, // Add refund tracking if needed
      amount: 0,
    },
    note: 'Metrics fetched from database cache. Sync data regularly for accuracy.',
  };
};

/**
 * Sync only new or updated Stripe customers, subscriptions, and payments to the database
 * Uses incremental sync based on last sync timestamp
 */
export const syncAllStripeDataToDb = async () => {
  const syncType = 'stripe_full';
  let recordsSynced = 0;

  try {
    // Get the last successful sync timestamp
    const lastSync = await prisma.syncLog.findUnique({
      where: { syncType },
    });

    const lastSyncTimestamp = lastSync?.lastSyncAt
      ? Math.floor(lastSync.lastSyncAt.getTime() / 1000)
      : undefined;

    console.log(
      `[Stripe Sync] Starting ${lastSyncTimestamp ? 'incremental' : 'full'} sync...`
    );

    // Mark sync as in progress
    await prisma.syncLog.upsert({
      where: { syncType },
      update: { status: 'in_progress', updatedAt: new Date() },
      create: {
        syncType,
        lastSyncAt: new Date(),
        status: 'in_progress',
        recordsSynced: 0,
      },
    });

    // Fetch customers created or updated after last sync
    const customers = await stripe.customers
      .list({
        limit: 100,
        created: lastSyncTimestamp ? { gte: lastSyncTimestamp } : undefined,
      })
      .autoPagingToArray({ limit: 10000 });

    console.log(`[Stripe Sync] Found ${customers.length} customers to sync`);

    for (const customer of customers) {
      // Upsert customer
      await prisma.customer.upsert({
        where: { stripeCustomerId: customer.id },
        update: {
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          metadata: customer.metadata as any,
        },
        create: {
          stripeCustomerId: customer.id,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          metadata: customer.metadata as any,
        },
      });
      recordsSynced++;

      // Fetch and upsert subscriptions for this customer (updated after last sync)
      const subscriptions = await stripe.subscriptions
        .list({
          customer: customer.id,
          status: 'all',
          limit: 100,
          created: lastSyncTimestamp ? { gte: lastSyncTimestamp } : undefined,
        })
        .autoPagingToArray({ limit: 1000 });

      for (const sub of subscriptions) {
        await prisma.subscription.upsert({
          where: { stripeSubscriptionId: sub.id },
          update: {
            stripeCustomerId: customer.id,
            status: sub.status,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
            metadata: sub as any,
          },
          create: {
            stripeSubscriptionId: sub.id,
            stripeCustomerId: customer.id,
            status: sub.status,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
            metadata: sub as any,
          },
        });
        recordsSynced++;
      }

      // Fetch and upsert invoices for this customer (created after last sync)
      const invoices = await stripe.invoices
        .list({
          customer: customer.id,
          limit: 100,
          created: lastSyncTimestamp ? { gte: lastSyncTimestamp } : undefined,
        })
        .autoPagingToArray({ limit: 1000 });

      for (const inv of invoices) {
        // First, upsert the invoice
        await prisma.invoice.upsert({
          where: { stripeInvoiceId: inv.id },
          update: {
            stripeCustomerId: customer.id,
            stripeSubscriptionId: (inv.subscription as string) || null,
            number: inv.number || null,
            status: inv.status || 'draft',
            amountDue: inv.amount_due,
            amountPaid: inv.amount_paid,
            amountRemaining: inv.amount_remaining,
            subtotal: inv.subtotal,
            total: inv.total,
            tax: inv.tax || null,
            currency: inv.currency,
            dueDate: inv.due_date ? new Date(inv.due_date * 1000) : null,
            paidAt: inv.status_transitions.paid_at
              ? new Date(inv.status_transitions.paid_at * 1000)
              : null,
            metadata: inv as any,
          },
          create: {
            stripeInvoiceId: inv.id,
            stripeCustomerId: customer.id,
            stripeSubscriptionId: (inv.subscription as string) || null,
            number: inv.number || null,
            status: inv.status || 'draft',
            amountDue: inv.amount_due,
            amountPaid: inv.amount_paid,
            amountRemaining: inv.amount_remaining,
            subtotal: inv.subtotal,
            total: inv.total,
            tax: inv.tax || null,
            currency: inv.currency,
            dueDate: inv.due_date ? new Date(inv.due_date * 1000) : null,
            paidAt: inv.status_transitions.paid_at
              ? new Date(inv.status_transitions.paid_at * 1000)
              : null,
            metadata: inv as any,
          },
        });

        // Then, if there's a payment intent, upsert the payment
        if (inv.payment_intent) {
          await prisma.payment.upsert({
            where: { stripePaymentIntentId: inv.payment_intent as string },
            update: {
              stripeCustomerId: customer.id,
              stripeInvoiceId: inv.id,
              amount: inv.amount_paid,
              currency: inv.currency,
              status: inv.status || 'draft',
              paidAt: inv.status_transitions.paid_at
                ? new Date(inv.status_transitions.paid_at * 1000)
                : null,
              metadata: inv as any,
            },
            create: {
              stripePaymentIntentId: inv.payment_intent as string,
              stripeCustomerId: customer.id,
              stripeInvoiceId: inv.id,
              amount: inv.amount_paid,
              currency: inv.currency,
              status: inv.status || 'draft',
              paidAt: inv.status_transitions.paid_at
                ? new Date(inv.status_transitions.paid_at * 1000)
                : null,
              metadata: inv as any,
            },
          });
        }
        recordsSynced++;
      }
    }

    // Mark sync as successful
    await prisma.syncLog.upsert({
      where: { syncType },
      update: {
        lastSyncAt: new Date(),
        status: 'success',
        recordsSynced,
        errorMessage: null,
      },
      create: {
        syncType,
        lastSyncAt: new Date(),
        status: 'success',
        recordsSynced,
      },
    });

    console.log(`[Stripe Sync] Successfully synced ${recordsSynced} records`);
  } catch (error: any) {
    // Mark sync as failed
    await prisma.syncLog.upsert({
      where: { syncType },
      update: {
        status: 'failed',
        errorMessage: error.message,
      },
      create: {
        syncType,
        lastSyncAt: new Date(),
        status: 'failed',
        recordsSynced: 0,
        errorMessage: error.message,
      },
    });
    throw error;
  }
};
