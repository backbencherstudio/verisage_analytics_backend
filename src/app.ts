import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import router from './routes';
import { config } from './config/env';

const app: Application = express();

// Stripe webhook raw body parse (required for signature verification)
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }));

// Use a larger, configurable limit to avoid "request entity too large" errors for large payloads
const clientWebhookLimit = (config.clientWebhook && (config.clientWebhook as any).maxBody) || '10mb';
app.use('/api/webhooks/client', express.raw({ type: 'application/json', limit: clientWebhookLimit }));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(helmet());
const corsOrigin = Array.isArray(config.corsOrigin)
  ? config.corsOrigin.filter((o): o is string => typeof o === 'string')
  : config.corsOrigin;
app.use(cors({ origin: corsOrigin, credentials: true }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
  status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api', router);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  res.status(500).json({
  error: 'Internal Server Error',
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Something went wrong',
  });
});

export default app;
