import { Router, Request, Response } from 'express';
import { getPaymentAnalytics } from '../../analytics/payment';

const router = Router();

/**
 * GET /api/analytics/payment
 * Get payment analytics
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    // Normalize YYYY-MM-DD to full UTC day range
    const isDateOnly = (s: string) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(s);
    const makeUtcDate = (s: string, endOfDay = false) => {
      const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
      return endOfDay
        ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
        : new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    };
    const parseDate = (s: string, endOfDay = false) =>
      isDateOnly(s) ? makeUtcDate(s, endOfDay) : new Date(s);

    const start = startDate ? parseDate(startDate as string, false) : undefined;
    const end = endDate ? parseDate(endDate as string, true) : undefined;

    const analytics = await getPaymentAnalytics(start, end);

    res.json({
      success: true,
      data: analytics,
      metadata: {
        dateRange: start && end ? { start, end } : null,
      },
    });
  } catch (error: any) {
    console.error('Payment analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch payment analytics',
    });
  }
});

export default router;
