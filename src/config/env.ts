import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || process.env.CLIENT_APP_URL || '*',
  
  database: {
    url: process.env.DATABASE_URL || '',
    allowStartWithoutDb: process.env.ALLOW_START_WITHOUT_DB === 'true',
  },
  
  stripe: {
    // Support either full secret key or restricted key for read-only operations
    secretKey: process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  
  ga4: {
    enabled: process.env.GA4_ENABLED === 'true', // default disabled unless explicitly enabled
    propertyId: process.env.GA4_PROPERTY_ID || '',
    credentialsPath: process.env.GA4_CREDENTIALS_PATH || '',
    syncSchedule: process.env.GA4_SYNC_SCHEDULE || '0 */6 * * *', // Every 6 hours
  },
};

// Validate required environment variables
export const validateEnv = () => {
  const required = [
    'DATABASE_URL',
    // Accept either STRIPE_SECRET_KEY or STRIPE_RESTRICTED_KEY
    process.env.STRIPE_SECRET_KEY ? 'STRIPE_SECRET_KEY' : 'STRIPE_RESTRICTED_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'GA4_PROPERTY_ID',
    'GA4_CREDENTIALS_PATH',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
};
