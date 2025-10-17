import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply auth middleware to all routes in this router
router.use(authMiddleware);

// GET /api/stripe/users - List all users with basic info
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await prisma.customer.findMany({
      select: {
        id: true,
        stripeCustomerId: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/stripe/users/:id - Get user with all subscriptions, payments, refunds
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        subscriptions: true,
        payments: true,
      },
    });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
