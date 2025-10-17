import Stripe from 'stripe';

/**
 * Normalize Stripe event data for storage
 */
export const normalizeStripeEvent = (data: any): Record<string, any> => {
  return {
    id: data.id,
    object: data.object,
    created: data.created,
    livemode: data.livemode,
    // Add any additional fields you want to store
  };
};

/**
 * Normalize Stripe subscription data
 */
export const normalizeSubscription = (subscription: Stripe.Subscription) => {
  return {
    id: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    items: subscription.items.data.map((item) => ({
      id: item.id,
      priceId: item.price.id,
      productId: item.price.product,
      quantity: item.quantity,
    })),
  };
};

/**
 * Normalize Stripe invoice data
 */
export const normalizeInvoice = (invoice: Stripe.Invoice) => {
  return {
    id: invoice.id,
    customerId: invoice.customer,
    subscriptionId: invoice.subscription,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    status: invoice.status,
    paidAt: invoice.status_transitions.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000)
      : null,
  };
};

/**
 * Format currency amount (from cents to dollars)
 */
export const formatCurrency = (amount: number, currency: string = 'usd'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

/**
 * Format date for display
 */
export const formatDate = (date: Date | number): string => {
  const d = typeof date === 'number' ? new Date(date * 1000) : date;
  return d.toISOString().split('T')[0];
};
