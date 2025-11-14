import express, { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { config } from '../config/env';
import { handleStripeWebhook } from '../services/stripe.service';

const router = Router();
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2024-06-20',
});

// Stripe webhook endpoint
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string | undefined;

  let event: Stripe.Event;

  try {
    if (sig) {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.stripe.webhookSecret
      );
    } else if (
      process.env.STRIPE_ALLOW_UNVERIFIED_WEBHOOKS === 'true' &&
      config.nodeEnv !== 'production'
    ) {
      const raw = (req.body as Buffer).toString('utf8');
      event = JSON.parse(raw) as Stripe.Event;
      console.warn('[DEV ONLY] Processing Stripe webhook without signature verification');
    } else {
      return res
        .status(400)
        .send('Webhook Error: No stripe-signature header value was provided.');
    }
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await handleStripeWebhook(event);

    res.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
