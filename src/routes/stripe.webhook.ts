import express, { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { config } from '../config/env';
import { handleStripeWebhook } from '../services/stripe.service';

const router = Router();
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2024-06-20',
});

// Stripe webhook endpoint
// Note: Raw body parsing is configured in app.ts for this route
router.post(
  '/stripe',
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.stripe.webhookSecret
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      // Handle the event
      await handleStripeWebhook(event);

      // Return a response to acknowledge receipt of the event
      res.json({ received: true });
    } catch (error: any) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

export default router;
