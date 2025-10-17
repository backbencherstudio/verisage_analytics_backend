
import { Router, Request, Response } from 'express';
import { syncAllStripeDataToDb } from '../services/stripe.service';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// GET /api/stripe/sync/status - Report Stripe sync status
router.get('/sync/status', async (req: Request, res: Response) => {
  try {
    // Placeholder: In production, return last sync time, status, errors, etc.
    res.json({
      success: true,
      status: 'ok',
      lastSync: null, // TODO: Replace with actual last sync timestamp
      message: 'Stripe sync status endpoint is available.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Apply auth middleware to all routes in this router
router.use(authMiddleware);

// POST /api/stripe/sync - Sync all Stripe data to DB
router.post('/sync', async (req: Request, res: Response) => {
  try {
    await syncAllStripeDataToDb();
    res.json({ success: true, message: 'Stripe data synced to database.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
