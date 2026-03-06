import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../types';
import { authMiddleware, requireRole } from '../../middleware/auth';
import * as settingsService from '../../services/settings';

const router = Router();
const discountRouter = Router();

const updateSettingsSchema = z.object({
  ppnEnabled: z.boolean().optional(),
  ppnRate: z.number().min(0).max(100).optional(),
  restaurantName: z.string().max(255).optional(),
  restaurantAddress: z.string().optional(),
  receiptFooter: z.string().max(500).optional(),
  showPpnOnReceipt: z.boolean().optional(),
  qrisImageUrl: z.string().max(500).optional(),
  bankName: z.string().max(255).optional(),
  bankAccountNumber: z.string().max(50).optional(),
  bankAccountHolder: z.string().max(255).optional(),
  restaurantLogoUrl: z.string().max(500).optional(),
});

const updateEwalletSchema = z.object({
  isEnabled: z.boolean().optional(),
  qrImageUrl: z.string().max(500).optional(),
});

const createDiscountSchema = z.object({
  discountName: z.string().min(1).max(255),
  discountType: z.enum(['percentage', 'fixed_amount']),
  discountValue: z.number().positive(),
  appliedTo: z.enum(['whole_order', 'specific_items']),
  isActive: z.boolean().optional(),
});

const updateDiscountSchema = z.object({
  discountName: z.string().min(1).max(255).optional(),
  discountType: z.enum(['percentage', 'fixed_amount']).optional(),
  discountValue: z.number().positive().optional(),
  appliedTo: z.enum(['whole_order', 'specific_items']).optional(),
  isActive: z.boolean().optional(),
});

// --- POS Settings ---

router.get('/', authMiddleware as any, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await settingsService.getSettings();
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

router.patch(
  '/',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = updateSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        });
        return;
      }

      const result = await settingsService.updateSettings(parsed.data);
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
  },
);

// --- E-Wallet Providers ---

router.get(
  '/ewallet-providers',
  authMiddleware as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const isEnabledStr = req.query.isEnabled as string | undefined;
      const isEnabled =
        isEnabledStr === 'true' ? true : isEnabledStr === 'false' ? false : undefined;

      const result = await settingsService.listEwalletProviders({ isEnabled });
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
  },
);

router.patch(
  '/ewallet-providers/:id',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = updateEwalletSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        });
        return;
      }

      const result = await settingsService.updateEwalletProvider(req.params.id, parsed.data);
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
  },
);

// --- Discounts ---

discountRouter.get(
  '/',
  authMiddleware as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const isActiveStr = req.query.isActive as string | undefined;
      const isActive =
        isActiveStr === 'true' ? true : isActiveStr === 'false' ? false : undefined;

      const result = await settingsService.listDiscounts({ isActive });
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
  },
);

discountRouter.post(
  '/',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = createDiscountSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        });
        return;
      }

      const result = await settingsService.createDiscount(parsed.data);
      res.status(201).json({ success: true, data: result });
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
  },
);

discountRouter.patch(
  '/:id',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = updateDiscountSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        });
        return;
      }

      const result = await settingsService.updateDiscount(req.params.id, parsed.data);
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
  },
);

discountRouter.delete(
  '/:id',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await settingsService.deleteDiscount(req.params.id);
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
  },
);

export const settingsRouter = router;
export const discountsRouter = discountRouter;
