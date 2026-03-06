import { Router, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';
import {
  processPayment,
  voidOrder,
  listTransactions,
  getTransactionDetail,
  exportTransactions,
  listVoidRecords,
} from '../../services/payment/paymentService';

const router = Router();

// EP-050: POST /api/payments
router.post(
  '/payments',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { orderId, paymentMethod, amountPaid, digitalPaymentRef, transferProofPhotoUrl, discountId } = req.body;
      if (!orderId || !paymentMethod || amountPaid === undefined) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'orderId, paymentMethod, and amountPaid are required' },
        });
        return;
      }
      const result = await processPayment(
        { orderId, paymentMethod, amountPaid, digitalPaymentRef, transferProofPhotoUrl, discountId },
        req.user!.id,
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-051: POST /api/orders/:id/void
router.post(
  '/orders/:id/void',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { voidType, voidReason, voidNotes, voidedItems, pinVerified } = req.body;
      if (!voidType || !voidReason) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'voidType and voidReason are required' },
        });
        return;
      }
      const result = await voidOrder(
        req.params.id,
        { voidType, voidReason, voidNotes, voidedItems, pinVerified },
        req.user!.id,
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-052: GET /api/transactions
router.get(
  '/transactions',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { dateFrom, dateTo, transactionNumber, cashierId, shiftId, paymentMethod, totalMin, totalMax, transactionStatus } = req.query;
      const result = await listTransactions({
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        transactionNumber: transactionNumber as string,
        cashierId: cashierId as string,
        shiftId: shiftId as string,
        paymentMethod: paymentMethod as string,
        totalMin: totalMin as string,
        totalMax: totalMax as string,
        transactionStatus: transactionStatus as string,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-054: GET /api/transactions/export (registered before :id to avoid route conflict)
router.get(
  '/transactions/export',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { dateFrom, dateTo, cashierId, shiftId, paymentMethod } = req.query;
      const result = await exportTransactions({
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        cashierId: cashierId as string,
        shiftId: shiftId as string,
        paymentMethod: paymentMethod as string,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-053: GET /api/transactions/:id
router.get(
  '/transactions/:id',
  authMiddleware,
  requireRole('owner', 'waiter-cashier'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await getTransactionDetail(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// EP-055: GET /api/void-records
router.get(
  '/void-records',
  authMiddleware,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { shiftId, dateFrom, dateTo } = req.query;
      const result = await listVoidRecords({
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

export default router;
