import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { listTopEvents, sampleEventParams, listEventDetails, getEventDetail, discoverEventParams } from '../services/ga4.service';
import { prisma } from '../db/prisma';

const router = Router();

router.use(authMiddleware);

// Simple in-memory cache with TTL
const cache = new Map<string, { ts: number; data: any }>();
const TTL = 1000 * 60 * 5; 

function getCached(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: any) {
  cache.set(key, { ts: Date.now(), data });
}

// GET /api/ga4/events?days=30&limit=200
router.get('/events', async (req: Request, res: Response) => {
  try {
    const days = parseInt((req.query.days as string) || '30', 10);
    const limit = parseInt((req.query.limit as string) || '200', 10);
    const cacheKey = `events:${days}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const date = new Date();
  const db: any = prisma;
  const aggregates = await db.gA4EventAggregate.findMany({ where: { date }, orderBy: { total: 'desc' }, take: limit });
    if (aggregates && aggregates.length > 0) {
      setCached(cacheKey, aggregates);
      return res.json({ success: true, data: aggregates });
    }

    // Fallback to GA4 Data API if DB has no aggregates
    const rows = await listTopEvents(days, limit);
    setCached(cacheKey, rows);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Error fetching top events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ga4/events/details?days=30&limitEvents=500&limitBreakdown=10
router.get('/events/details', async (req: Request, res: Response) => {
  try {
    const days = parseInt((req.query.days as string) || '30', 10);
    const limitEvents = parseInt((req.query.limitEvents as string) || '500', 10);
    const limitBreakdown = parseInt((req.query.limitBreakdown as string) || '10', 10);
    const cacheKey = `events:details:${days}:${limitEvents}:${limitBreakdown}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const details = await listEventDetails(days, limitEvents, limitBreakdown);
    setCached(cacheKey, details);
    res.json({ success: true, data: details });
  } catch (error: any) {
    console.error('Error fetching event details from GA4 Data API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


router.post('/events/sync', async (_req: Request, res: Response) => {
  try {
    const ga4 = await import('../services/ga4.service');
    await ga4.syncGA4Data();
    res.json({ success: true, message: 'GA4 data sync triggered' });
  } catch (error: any) {
    console.error('Error syncing GA4 data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ga4/events/materialize - materialize top events into DB (GA4 Data API)
router.post('/events/materialize', async (req: Request, res: Response) => {
  try {
    const days = parseInt((req.body.days as string) || '30', 10);
    const topN = parseInt((req.body.topN as string) || '500', 10);
    const mat = await import('../services/ga4.materialize.service');
    await mat.materializeGA4TopEvents(days, topN);
    res.json({ success: true, message: 'GA4 event aggregates materialized into DB' });
  } catch (error: any) {
    console.error('Error materializing GA4 events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ga4/events/:name/params/materialize?paramKey=foo - materialize param aggregates for an event
router.post('/events/:name/params/materialize', async (req: Request, res: Response) => {
  try {
    const eventName = req.params.name;
    const paramKey = (req.query.paramKey as string) || (req.body.paramKey as string) || '';
    if (!paramKey) return res.status(400).json({ success: false, error: 'paramKey is required' });
    const days = parseInt((req.body.days as string) || (req.query.days as string) || '30', 10);
    const limit = parseInt((req.body.limit as string) || (req.query.limit as string) || '100', 10);
    const mat = await import('../services/ga4.materialize.service');
    await mat.materializeGA4EventParams(eventName, paramKey, days, limit);
    res.json({ success: true, message: `Materialized param aggregates for ${eventName}/${paramKey}` });
  } catch (error: any) {
    console.error('Error materializing GA4 event params:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ga4/events/:name/params?paramKey=foo&days=30&limit=100
router.get('/events/:name/params', async (req: Request, res: Response) => {
  try {
    const eventName = req.params.name;
    const paramKey = (req.query.paramKey as string) || '';
    if (!paramKey) return res.status(400).json({ success: false, error: 'paramKey is required' });

    const days = parseInt((req.query.days as string) || '30', 10);
    const limit = parseInt((req.query.limit as string) || '100', 10);
    const cacheKey = `params:${eventName}:${paramKey}:${days}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const date = new Date();
    const db: any = prisma;
    const paramAggs = await db.gA4EventParamAggregate.findMany({
      where: { date, eventName, paramKey },
      orderBy: { total: 'desc' },
      take: limit,
    });

    if (paramAggs && paramAggs.length > 0) {
      setCached(cacheKey, paramAggs);
      return res.json({ success: true, data: paramAggs });
    }

    try {
      const rows = await sampleEventParams(eventName, paramKey, days, limit);
      setCached(cacheKey, rows);
      return res.json({ success: true, data: rows });
    } catch (err: any) {
      console.error('Data API param sampling error:', err?.message || err);
      return res.status(400).json({
        success: false,
        error:
          'GA4 Data API cannot provide raw event parameter sampling for this property. To access raw event params you must enable BigQuery export or use the GA4 BigQuery export dataset.',
      });
    }
  } catch (error: any) {
    console.error('Error fetching event params from BigQuery:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ga4/events/:name - full detail for a single event
router.get('/events/:name', async (req: Request, res: Response) => {
  try {
    const eventName = req.params.name;
    const days = parseInt((req.query.days as string) || '30', 10);
    const limitBreakdown = parseInt((req.query.limitBreakdown as string) || '20', 10);
    const cacheKey = `event:detail:${eventName}:${days}:${limitBreakdown}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const db: any = prisma;
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const dbAgg = await db.gA4EventAggregate.findUnique({ where: { date_eventName: { date, eventName } } }).catch(() => null);

    const details = await getEventDetail(eventName, days, limitBreakdown);
    if (dbAgg) details.dbAggregate = dbAgg;

    setCached(cacheKey, details);
    res.json({ success: true, data: details });
  } catch (error: any) {
    console.error('Error fetching event detail:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ga4/events/:name/discover-params?days=30&keys=token_id,video_id
router.get('/events/:name/discover-params', async (req: Request, res: Response) => {
  try {
    const eventName = req.params.name;
    const days = parseInt((req.query.days as string) || '30', 10);
    const keysRaw = (req.query.keys as string) || '';
    const candidates = keysRaw ? keysRaw.split(',').map((k) => k.trim()).filter(Boolean) : undefined;
    const cacheKey = `event:discover:params:${eventName}:${days}:${keysRaw}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const results = await discoverEventParams(eventName, candidates as any, days, 10);
    setCached(cacheKey, results);
    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error('Error discovering event params:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ga4/events/:name/raw?days=7&limit=100
router.get('/events/:name/raw', async (req: Request, res: Response) => {
  try {
    const eventName = req.params.name;
    const days = parseInt((req.query.days as string) || '7', 10);
    const limit = parseInt((req.query.limit as string) || '100', 10);
    const cacheKey = `raw:${eventName}:${days}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    return res.status(400).json({
      success: false,
      error:
        'Raw event sampling is only available via GA4 BigQuery export. This backend is configured to use the Data API only and does not store raw event rows in the database. Enable GA4 BigQuery export to materialize raw events into the DB.',
    });
  } catch (error: any) {
    console.error('Error fetching raw events from BigQuery:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
