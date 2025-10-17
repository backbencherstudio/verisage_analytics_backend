import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string | null;
        isActive: boolean;
      };
    }
  }
}

/**
 * Middleware to protect routes - requires valid JWT token
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided. Please login.',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token and get user
    const user = await verifyToken(token);

    // Attach user to request object
    req.user = user;

    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: error.message || 'Invalid or expired token',
    });
  }
};
