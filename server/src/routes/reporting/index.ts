import { Router, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';
import {
  getDashboard,
  getSalesSummary,
} from '../../services/reporting/reportingService';

const router = Router();

// EP-062: GET /api/reports/dashboard
router.get(
  '/reports/dashboard',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const result = await getDashboard({
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-063: GET /api/reports/sales-summary
router.get(
  '/reports/sales-summary',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { dateFrom, dateTo, groupBy } = req.query;
      if (!dateFrom || !dateTo) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'dateFrom and dateTo are required' },
        });
        return;
      }
      const result = await getSalesSummary({
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        groupBy: groupBy as string,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
