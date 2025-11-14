import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import ga4DashboardService from '../services/ga4.dashboard.service';

const router = Router();

router.use(authMiddleware);

// GET /api/ga4/dashboard/summary?days=30&topN=10&paramLimit=5
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const days = parseInt((req.query.days as string) || '30', 10);
    const topN = parseInt((req.query.topN as string) || '10', 10);
    const paramLimit = parseInt((req.query.paramLimit as string) || '5', 10);

    const data = await ga4DashboardService.getGA4DashboardSummary({ days, topN, paramLimit });
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching GA4 dashboard summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
