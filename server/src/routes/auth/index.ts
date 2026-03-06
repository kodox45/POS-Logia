import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../types';
import { authMiddleware } from '../../middleware/auth';
import * as authService from '../../services/auth';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const verifyPinSchema = z.object({
  userId: z.string().uuid(),
  pin: z.string().min(4).max(6),
  context: z.enum(['shift_open', 'pos_entry', 'void_operation']),
});

router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Username and password are required' },
      });
      return;
    }

    const result = await authService.login(parsed.data.username, parsed.data.password);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    throw error;
  }
});

router.post('/logout', authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await authService.logout(req.sessionToken!);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    throw error;
  }
});

router.post('/verify-pin', authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = verifyPinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'userId, pin, and context are required' },
      });
      return;
    }

    const result = await authService.verifyPin(
      parsed.data.userId,
      parsed.data.pin,
      parsed.data.context,
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    throw error;
  }
});

router.get('/session', authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await authService.getSessionInfo(req.sessionToken!);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    throw error;
  }
});

export default router;
