import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../types';
import { authMiddleware, requireRole } from '../../middleware/auth';
import * as recipeService from '../../services/recipe';

const router = Router();

const ingredientSchema = z.object({
  inventoryItemId: z.string().uuid(),
  quantityRequired: z.number().positive(),
  unit: z.string().min(1).max(50),
});

const stepSchema = z.object({
  stepOrder: z.number().int().positive(),
  instruction: z.string().min(1),
});

const createRecipeSchema = z.object({
  menuItemId: z.string().uuid(),
  cookingTime: z.number().int().positive().optional(),
  difficultyLevel: z.enum(['easy', 'medium', 'hard']).optional(),
  notes: z.string().optional(),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(stepSchema).min(1),
});

const updateRecipeSchema = z.object({
  cookingTime: z.number().int().positive().optional(),
  difficultyLevel: z.enum(['easy', 'medium', 'hard']).optional(),
  notes: z.string().optional(),
  ingredients: z.array(ingredientSchema).optional(),
  steps: z.array(stepSchema).optional(),
});

router.get('/', authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const menuItemId = req.query.menuItemId as string | undefined;
    const result = await recipeService.listRecipes({ menuItemId });
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
    const result = await recipeService.getRecipeById(req.params.id);
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
      const parsed = createRecipeSchema.safeParse(req.body);
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

      const result = await recipeService.createRecipe(parsed.data);
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
      const parsed = updateRecipeSchema.safeParse(req.body);
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

      const result = await recipeService.updateRecipe(req.params.id, parsed.data);
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
      const result = await recipeService.deleteRecipe(req.params.id);
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

export default router;
