import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../types';
import { authMiddleware, requireRole } from '../../middleware/auth';
import * as menuService from '../../services/menu';

const router = Router();
const categoryRouter = Router();

const createMenuItemSchema = z.object({
  itemName: z.string().min(1).max(255),
  price: z.number().positive(),
  categoryId: z.string().uuid(),
  description: z.string().optional(),
  isAvailable: z.boolean().optional(),
  imageUrl: z.string().max(500).optional(),
});

const updateMenuItemSchema = z.object({
  itemName: z.string().min(1).max(255).optional(),
  price: z.number().positive().optional(),
  categoryId: z.string().uuid().optional(),
  description: z.string().optional(),
  isAvailable: z.boolean().optional(),
  imageUrl: z.string().max(500).optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  sortOrder: z.number().int().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sortOrder: z.number().int().optional(),
});

// --- Menu Items ---

router.get('/', authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categoryId = req.query.categoryId as string | undefined;
    const isAvailableStr = req.query.isAvailable as string | undefined;
    const isAvailable =
      isAvailableStr === 'true' ? true : isAvailableStr === 'false' ? false : undefined;
    const search = req.query.search as string | undefined;

    const result = await menuService.listMenuItems({ categoryId, isAvailable, search });
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

router.get('/:id', authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await menuService.getMenuItemById(req.params.id);
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

router.post(
  '/',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = createMenuItemSchema.safeParse(req.body);
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

      const result = await menuService.createMenuItem(parsed.data);
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

router.patch(
  '/:id',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = updateMenuItemSchema.safeParse(req.body);
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

      const result = await menuService.updateMenuItem(req.params.id, parsed.data);
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

router.delete(
  '/:id',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await menuService.deleteMenuItem(req.params.id);
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

// --- Menu Categories ---

categoryRouter.get('/', authMiddleware as any, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await menuService.listCategories();
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

categoryRouter.post(
  '/',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = createCategorySchema.safeParse(req.body);
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

      const result = await menuService.createCategory(parsed.data);
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

categoryRouter.patch(
  '/:id',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = updateCategorySchema.safeParse(req.body);
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

      const result = await menuService.updateCategory(req.params.id, parsed.data);
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

categoryRouter.delete(
  '/:id',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await menuService.deleteCategory(req.params.id);
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

export const menuItemsRouter = router;
export const menuCategoriesRouter = categoryRouter;
