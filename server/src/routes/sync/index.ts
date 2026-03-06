import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../types';
import { authMiddleware } from '../../middleware/auth';
import * as syncService from '../../services/sync/syncService';

const router = Router();

// EP-072: POST /api/sync/push
const pushSchema = z.object({
  changes: z.array(
    z.object({
      entity: z.string().min(1),
      syncId: z.string().min(1),
      operation: z.enum(['create', 'update', 'delete']),
      data: z.record(z.unknown()),
      timestamp: z.string().min(1),
    }),
  ),
  deviceId: z.string().min(1),
});

router.post('/push', authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = pushSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid push payload: changes array and deviceId are required',
        },
      });
      return;
    }

    const result = await syncService.pushChanges(parsed.data.changes, parsed.data.deviceId);

    if (result.conflicts.length > 0 && result.synced === 0) {
      res.status(409).json({
        success: false,
        error: {
          code: 'SYNC_CONFLICT',
          message: 'Conflict detected, resolve before retry',
        },
        data: result,
      });
      return;
    }

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

// EP-073: POST /api/sync/pull
const pullSchema = z.object({
  lastSyncedAt: z.string().min(1),
  deviceId: z.string().min(1),
});

router.post('/pull', authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = pullSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'lastSyncedAt and deviceId are required',
        },
      });
      return;
    }

    const result = await syncService.pullChanges(parsed.data.lastSyncedAt, parsed.data.deviceId);
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

// EP-074: GET /api/sync/status
router.get('/status', authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await syncService.getSyncStatus();
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
