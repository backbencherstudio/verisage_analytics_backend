import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: [
    process.env.CORS_ORIGIN,
    process.env.CLIENT_APP_URL,
    process.env.PRODUCTION_APP_URL,
    "*",
  ],

  database: {
    url: process.env.DATABASE_URL || "",
    allowStartWithoutDb: process.env.ALLOW_START_WITHOUT_DB === "true",
  },

  stripe: {
    secretKey:
      process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    syncSchedule: process.env.STRIPE_SYNC_SCHEDULE || "0 3 * * *",
  },

  ga4: {
    enabled: process.env.GA4_ENABLED === "true", 
    propertyId: process.env.GA4_PROPERTY_ID || "",
    credentialsPath: process.env.GA4_CREDENTIALS_PATH || "",
    syncSchedule: process.env.GA4_SYNC_SCHEDULE || "0 2 * * *",
  },

  clientWebhook: {
    secret: process.env.CLIENT_WEBHOOK_SECRET || "",
    allowUnverified: process.env.CLIENT_ALLOW_UNVERIFIED_WEBHOOKS === "true",

    startWorker: process.env.CLIENT_WEBHOOK_START_WORKER === "true",
    // max body size for raw webhook parsing (express accepts sizes like '100kb', '1mb', '10mb')
    maxBody: process.env.CLIENT_WEBHOOK_MAX_BODY || '10mb',
  },
};

// Validate required environment variables
export const validateEnv = () => {
  const required = [
    "DATABASE_URL",
    process.env.STRIPE_SECRET_KEY
      ? "STRIPE_SECRET_KEY"
      : "STRIPE_RESTRICTED_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "GA4_PROPERTY_ID",
    "GA4_CREDENTIALS_PATH",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};
