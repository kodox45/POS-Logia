import { Router, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';
import {
  listOrders,
  getOrder,
  createOrder,
  addItemsToOrder,
  updateOrderStatus,
} from '../../services/order-management/orderService';
import {
  listTables,
  getTable,
  createTable,
  updateTable,
  deleteTable,
} from '../../services/order-management/tableService';

const router = Router();

// === ORDER ENDPOINTS ===

// EP-035: GET /api/orders
router.get(
  '/orders',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { orderStatus, tableId, shiftId, dateFrom, dateTo } = req.query;
      const result = await listOrders({
        orderStatus: orderStatus as any,
        tableId: tableId as string,
        shiftId: shiftId as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-036: GET /api/orders/:id
router.get(
  '/orders/:id',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await getOrder(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-037: POST /api/orders
router.post(
  '/orders',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { tableId, items, specialNotes, discountId } = req.body;
      if (!tableId) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'tableId is required' },
        });
        return;
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_ITEMS', message: 'Order must have at least one menu item' },
        });
        return;
      }
      const result = await createOrder({ tableId, items, specialNotes, discountId }, req.user!.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-038: POST /api/orders/:id/add-items
router.post(
  '/orders/:id/add-items',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_ITEMS', message: 'items array is required' },
        });
        return;
      }
      const result = await addItemsToOrder(req.params.id, { items }, req.user!.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-039: PATCH /api/orders/:id/status
router.patch(
  '/orders/:id/status',
  authMiddleware,
  requireRole('owner', 'waiter-cashier', 'chef'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      if (!status) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'status is required' },
        });
        return;
      }
      const result = await updateOrderStatus(req.params.id, status, req.user!.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// === TABLE ENDPOINTS ===

// EP-040: GET /api/tables
router.get(
  '/tables',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { status } = req.query;
      const result = await listTables({ status: status as any });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-041: GET /api/tables/:id
router.get(
  '/tables/:id',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await getTable(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-042: POST /api/tables
router.post(
  '/tables',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { tableName, tableNumber, capacity } = req.body;
      if (!tableName || tableNumber === undefined) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'tableName and tableNumber are required' },
        });
        return;
      }
      const result = await createTable({ tableName, tableNumber, capacity });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-043: PATCH /api/tables/:id
router.patch(
  '/tables/:id',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { tableName, capacity } = req.body;
      const result = await updateTable(req.params.id, { tableName, capacity });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-044: DELETE /api/tables/:id
router.delete(
  '/tables/:id',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await deleteTable(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
