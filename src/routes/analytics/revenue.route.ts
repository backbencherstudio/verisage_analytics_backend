import { Router, Request, Response } from 'express';
import { getRevenueAnalytics, revenueAnalyticsDetails } from '../../analytics/revenue';

const router = Router();

// GET /api/analytics/revenue - Get revenue analytics with optional date range
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

    const dateRange = (startDate && endDate)
      ? {
          start: parseDate(startDate as string, false),
          end: parseDate(endDate as string, true)
        }
      : undefined;

    const analytics = await getRevenueAnalytics(dateRange);

    res.json({
      success: true,
      data: analytics,
      metadata: {
        dateRange: dateRange ? dateRange : null,
        details: revenueAnalyticsDetails
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
