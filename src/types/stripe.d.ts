import Stripe from 'stripe';

// Extend Stripe types if needed
declare module 'stripe' {
  namespace Stripe {
    interface SubscriptionMetadata {
      customField?: string;
    }
  }
}

// Custom types for your application
export interface SubscriptionMetrics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  canceledSubscriptions: number;
  trialSubscriptions: number;
  revenue: {
    mrr: number; 
    arr: number; 
    total: number;
  };
}

export interface PaymentMetrics {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  totalAmount: number;
  averageAmount: number;
}

export interface WebhookEventType {
  type: string;
  data: any;
  timestamp: Date;
}
