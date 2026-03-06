import { Router, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';
import {
  getKitchenOrders,
  startCooking,
  markReady,
  getNotifications,
  acknowledgeNotification,
} from '../../services/kitchen/kitchenService';

const router = Router();

// EP-045: GET /api/kitchen/orders
router.get(
  '/kitchen/orders',
  authMiddleware,
  requireRole('owner', 'chef'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { status } = req.query;
      const result = await getKitchenOrders({ status: status as string });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-046: PATCH /api/kitchen/orders/:id/start-cooking
router.patch(
  '/kitchen/orders/:id/start-cooking',
  authMiddleware,
  requireRole('chef', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await startCooking(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-047: PATCH /api/kitchen/orders/:id/mark-ready
router.patch(
  '/kitchen/orders/:id/mark-ready',
  authMiddleware,
  requireRole('chef', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await markReady(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-048: GET /api/kitchen/notifications
router.get(
  '/kitchen/notifications',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await getNotifications();
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-049: PATCH /api/kitchen/notifications/:id/acknowledge
router.patch(
  '/kitchen/notifications/:id/acknowledge',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await acknowledgeNotification(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
