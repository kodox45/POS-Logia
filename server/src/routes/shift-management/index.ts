import { Router, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';
import {
  openShift,
  getActiveShift,
  getShiftSummary,
  closeShift,
  listShifts,
  getShiftDetail,
} from '../../services/shift-management/shiftService';

const router = Router();

// EP-056: POST /api/shifts/open
router.post(
  '/shifts/open',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { openingBalance, pinVerified } = req.body;
      if (openingBalance === undefined) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'openingBalance is required' },
        });
        return;
      }
      const result = await openShift({ openingBalance, pinVerified }, req.user!.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-057: GET /api/shifts/active
router.get(
  '/shifts/active',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await getActiveShift(req.user!.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-058: GET /api/shifts/:id/summary
router.get(
  '/shifts/:id/summary',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await getShiftSummary(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-059: POST /api/shifts/:id/close
router.post(
  '/shifts/:id/close',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { actualCash, closingNotes } = req.body;
      if (actualCash === undefined) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'actualCash is required' },
        });
        return;
      }
      const result = await closeShift(req.params.id, { actualCash, closingNotes });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-060: GET /api/shifts
router.get(
  '/shifts',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { shiftStatus, picCashierId, dateFrom, dateTo, hasDiscrepancy } = req.query;
      const result = await listShifts({
        shiftStatus: shiftStatus as string,
        picCashierId: picCashierId as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        hasDiscrepancy: hasDiscrepancy as string,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-061: GET /api/shifts/:id
router.get(
  '/shifts/:id',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await getShiftDetail(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
