import { Router, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';
import {
  listInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  restockInventoryItem,
  adjustInventoryItem,
  getStockMovements,
  getLowStockItems,
  checkStock,
} from '../../services/inventory/inventoryService';

const router = Router();

// EP-025: GET /api/inventory-items
router.get(
  '/inventory-items',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { stockStatus, search } = req.query;
      const result = await listInventoryItems({
        stockStatus: stockStatus as any,
        search: search as string,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-026: GET /api/inventory-items/:id
router.get(
  '/inventory-items/:id',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await getInventoryItem(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-027: POST /api/inventory-items
router.post(
  '/inventory-items',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { itemName, quantity, unit, minimumThreshold } = req.body;

      if (!itemName || quantity === undefined || !unit) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'itemName, quantity, and unit are required' },
        });
        return;
      }

      const result = await createInventoryItem({ itemName, quantity, unit, minimumThreshold });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-028: PATCH /api/inventory-items/:id
router.patch(
  '/inventory-items/:id',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { itemName, unit, minimumThreshold } = req.body;
      const result = await updateInventoryItem(req.params.id, { itemName, unit, minimumThreshold });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-029: DELETE /api/inventory-items/:id
router.delete(
  '/inventory-items/:id',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await deleteInventoryItem(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-030: POST /api/inventory-items/:id/restock
router.post(
  '/inventory-items/:id/restock',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { quantity, reason } = req.body;
      if (quantity === undefined || quantity <= 0) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'quantity must be a positive number' },
        });
        return;
      }
      const result = await restockInventoryItem(req.params.id, { quantity, reason }, req.user!.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-031: POST /api/inventory-items/:id/adjust
router.post(
  '/inventory-items/:id/adjust',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { newQuantity, reason } = req.body;
      if (newQuantity === undefined) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'newQuantity is required' },
        });
        return;
      }
      if (!reason) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'reason is mandatory for manual adjustment' },
        });
        return;
      }
      const result = await adjustInventoryItem(req.params.id, { newQuantity, reason }, req.user!.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-032: GET /api/inventory-items/:id/movements
router.get(
  '/inventory-items/:id/movements',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { movementType, dateFrom, dateTo } = req.query;
      const result = await getStockMovements(req.params.id, {
        movementType: movementType as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-033: GET /api/inventory/low-stock
router.get(
  '/inventory/low-stock',
  authMiddleware,
  requireRole('owner'),
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await getLowStockItems();
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-034: POST /api/inventory/check-stock
router.post(
  '/inventory/check-stock',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'items array is required' },
        });
        return;
      }
      const result = await checkStock(items);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
