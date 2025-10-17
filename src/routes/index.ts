import { Router } from 'express';
import stripeWebhookRouter from './stripe.webhook';
import metricsRouter from './metrics.route';
import stripeUserRouter from './stripe.user.route';
import stripeSyncRouter from './stripe.sync.route';
import authRouter from './auth.route';
import customerAnalyticsRouter from './analytics/customer.route';
import revenueAnalyticsRouter from './analytics/revenue.route';
import subscriptionAnalyticsRouter from './analytics/subscription.route';
import paymentAnalyticsRouter from './analytics/payment.route';
import refundAnalyticsRouter from './analytics/refund.route';
import planAnalyticsRouter from './analytics/plan.route';

const router = Router();

// Auth routes (public)
router.use('/auth', authRouter);

// Webhook routes
router.use('/webhooks', stripeWebhookRouter);

// Metrics routes
router.use('/metrics', metricsRouter);

// Analytics routes
router.use('/analytics/customers', customerAnalyticsRouter);
router.use('/analytics/revenue', revenueAnalyticsRouter);
router.use('/analytics/subscriptions', subscriptionAnalyticsRouter);
router.use('/analytics/payments', paymentAnalyticsRouter);
router.use('/analytics/refunds', refundAnalyticsRouter);
router.use('/analytics/plans', planAnalyticsRouter);

// Stripe user routes
router.use('/stripe/users', stripeUserRouter);

// Stripe sync route
router.use('/stripe', stripeSyncRouter);

export default router;
