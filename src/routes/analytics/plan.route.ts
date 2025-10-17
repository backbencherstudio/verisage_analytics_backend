import { Router, Request, Response } from 'express';
import { getPlanAnalytics } from '../../analytics/plan';

const router = Router();

/**
 * GET /api/analytics/plan
 * Get plan/product analytics
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const analytics = await getPlanAnalytics(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    console.error('Plan analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch plan analytics',
    });
  }
});

export default router;
