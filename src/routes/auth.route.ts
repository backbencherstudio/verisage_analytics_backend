import { Router, Request, Response } from "express";
import { login } from "../services/auth.service";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// POST /api/auth/login - Login existing user
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const result = await login({ email, password });

    res.json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/auth/me - Get current logged-in user
router.get("/me", authMiddleware, (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }
  res.json({
    success: true,
    data: req.user,
  });
});

export default router;
