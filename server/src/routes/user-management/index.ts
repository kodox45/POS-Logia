import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../types';
import { authMiddleware, requireRole } from '../../middleware/auth';
import * as userService from '../../services/user-management';

const router = Router();

const createUserSchema = z.object({
  username: z.string().min(1).max(255),
  password: z.string().min(4),
  displayName: z.string().min(1).max(255),
  role: z.enum(['waiter-cashier', 'chef']),
  pin: z.string().min(4).max(6).optional(),
});

const updateUserSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  password: z.string().min(4).optional(),
  pin: z.string().min(4).max(6).optional(),
  isActive: z.boolean().optional(),
});

const updatePermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      permissionKey: z.string().min(1),
      isGranted: z.boolean(),
    }),
  ),
});

router.get(
  '/',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const role = req.query.role as string | undefined;
      const isActiveStr = req.query.isActive as string | undefined;
      const isActive =
        isActiveStr === 'true' ? true : isActiveStr === 'false' ? false : undefined;

      const result = await userService.listUsers({ role, isActive });
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

router.get(
  '/:id',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await userService.getUserById(req.params.id);
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

router.post(
  '/',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
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

      const result = await userService.createUser(parsed.data);
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
      const parsed = updateUserSchema.safeParse(req.body);
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

      const result = await userService.updateUser(req.params.id, parsed.data);
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

router.get(
  '/:id/permissions',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await userService.getUserPermissions(req.params.id);
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
  '/:id/permissions',
  authMiddleware as any,
  requireRole('owner') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = updatePermissionsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'permissions array is required',
          },
        });
        return;
      }

      const result = await userService.updateUserPermissions(
        req.params.id,
        parsed.data.permissions,
      );
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
