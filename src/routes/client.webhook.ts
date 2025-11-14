import e, { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import crypto from "crypto";
import { prisma } from "../db/prisma";
import { config } from "../config/env";
import clientWebhookQueue from "../services/queue";

const router = Router();

function validatePayload(payload: any) {
  if (!payload || typeof payload !== "object")
    return "Payload must be a JSON object";

  if (!payload.eventId || typeof payload.eventId !== "string")
    return "eventId (string) is required";

  if (!payload.eventType || typeof payload.eventType !== "string")
    return "eventType (string) is required";

  if (!payload.timestamp || typeof payload.timestamp !== "string")
    return "timestamp (ISO string) is required";

  // basic ISO timestamp check
  const t = Date.parse(payload.timestamp);
  if (Number.isNaN(t)) return "timestamp must be a valid ISO 8601 datetime";

  // require started/completed (accept variants)
  const started =
    payload.startedAt || payload.time_stamp_started || payload.timeStampStarted;

  const completed =
    payload.completedAt ||
    payload.time_stamp_completed ||
    payload.timeStampCompleted;

  if (!started) return "startedAt / time_stamp_started is required";

  if (!completed) return "completedAt / time_stamp_completed is required";

  if (Number.isNaN(Date.parse(started)))
    return "startedAt must be a valid ISO 8601 datetime";

  if (Number.isNaN(Date.parse(completed)))
    return "completedAt must be a valid ISO 8601 datetime";

  return null;
}

router.post("/client", async (req: Request, res: Response) => {
  const secret = config.clientWebhook.secret;

  const sigHeader = (req.headers["x-client-signature"] as string) || "";
  const tsHeader = (req.headers["x-client-timestamp"] as string) || "";

  const raw =
    req.body instanceof Buffer
      ? req.body.toString("utf8")
      : JSON.stringify(req.body || {});

  // Verification
  if (secret) {
    if (!sigHeader || !tsHeader) {
      return res.status(400).json({
        success: false,
        error: "Missing signature or timestamp headers",
      });
    }

    const ts = parseInt(tsHeader, 10);
    if (Number.isNaN(ts))
      return res
        .status(400)
        .json({ success: false, error: "Invalid timestamp header" });

    const now = Math.floor(Date.now() / 1000);
    const allowedSkew = 60 * 10; // 10 minutes
    if (Math.abs(now - ts) > allowedSkew) {
      return res.status(400).json({
        success: false,
        error: "Timestamp outside the allowed window",
      });
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${ts}.${raw}`)
      .digest("hex");
    const valid = (() => {
      try {
        return crypto.timingSafeEqual(
          Buffer.from(expected),
          Buffer.from(sigHeader)
        );
      } catch (e) {
        return false;
      }
    })();

    if (!valid)
      return res
        .status(400)
        .json({ success: false, error: "Invalid signature" });
  } else {
    if (
      !config.clientWebhook.allowUnverified &&
      config.nodeEnv === "production"
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Webhook signatures not configured" });
    }
    console.warn("[DEV] Accepting unverified client webhook");
  }

  // Parse payload
  let payload: any = null;
  try {
    payload = raw && raw.length ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Invalid JSON payload");
    return res
      .status(400)
      .json({ success: false, error: "Invalid JSON payload" });
  }

  // Validate
  const vErr = validatePayload(payload);
  if (vErr) return res.status(400).json({ success: false, error: vErr });

  // Enqueue event for asynchronous processing to improve throughput and avoid DB contention
  try {
    const eventId = payload.eventId || null;
    const tokenId = payload.tokenId || payload.token_id || null;
    const userId = payload.userId || payload.user_id || null;
    const actionName =
      payload.action || payload.action_name || payload.actionName || payload.eventType || "client_event";
    const startedRaw = payload.startedAt || payload.time_stamp_started || payload.timeStampStarted || null;
    const completedRaw = payload.completedAt || payload.time_stamp_completed || payload.timeStampCompleted || null;
    const durationMs = payload.durationMs ?? null;

    const jobData = {
      eventId,
      eventType: payload.eventType || null,
      timestamp: payload.timestamp || null,
      startedAt: startedRaw,
      completedAt: completedRaw,
      tokenId,
      userId,
      actionName,
      durationMs,
      payload,
    };

    const jobOpts: any = {
      removeOnComplete: { age: 60 * 60, count: 1000 },
      removeOnFail: { age: 60 * 60, count: 1000 },
    };
    if (eventId) jobOpts.jobId = eventId;

    const job = await clientWebhookQueue.add('clientWebhook', jobData, jobOpts);

    return res.json({ success: true, enqueued: true, jobId: job.id });
  } catch (err: any) {
    console.error('Failed to enqueue ClientWebhookEvent:', err);
    return res.status(500).json({ success: false, error: 'Failed to enqueue event' });
  }
});

// GET /api/webhooks/client - list client webhook events (protected)
router.get("/client", authMiddleware, async (req: Request, res: Response) => {
  try {
    const where: any = {};
    if (req.query.eventId) where.eventId = String(req.query.eventId);
    if (req.query.tokenId) where.tokenId = String(req.query.tokenId);
    if (req.query.userId) where.userId = String(req.query.userId);
    if (req.query.actionName) where.action_Name = String(req.query.actionName);
    if (req.query.from || req.query.to) {
      where.time_stamp_started = {} as any;
      if (req.query.from)
        where.time_stamp_started.gte = new Date(String(req.query.from));
      if (req.query.to)
        where.time_stamp_started.lte = new Date(String(req.query.to));
    }

    const pageParam = req.query.page as string | undefined;
    const limitParam = req.query.limit as string | undefined;


    const usesPagination = Boolean(pageParam);

    const total = await prisma.clientWebhookEvent.count({ where });

    if (usesPagination) {
      const page = Math.max(1, parseInt(pageParam || "1", 10));
      const limit = limitParam ? Math.min(1000, Math.max(1, parseInt(limitParam, 10))) : 20;
      const skip = (page - 1) * limit;

      const rows = await prisma.clientWebhookEvent.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        skip,
        take: limit,
      });

      return res.json({
        success: true,
        data: { total, page, limit, shown: rows.length, rows },
      });
    }

    const rows = await prisma.clientWebhookEvent.findMany({
      where,
      orderBy: { receivedAt: "desc" },
    });

    res.json({ success: true, data: { total, shown: rows.length, rows } });
  } catch (err: any) {
    console.error("Error listing client webhook events:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
