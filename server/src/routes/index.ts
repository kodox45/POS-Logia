import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import userManagementRouter from './user-management';
import { menuItemsRouter, menuCategoriesRouter } from './menu';
import recipeRouter from './recipe';
import { settingsRouter, discountsRouter } from './settings';
import syncRouter from './sync';
import inventoryRouter from './inventory';
import orderManagementRouter from './order-management';
import kitchenRouter from './kitchen';
import paymentRouter from './payment';
import shiftManagementRouter from './shift-management';
import reportingRouter from './reporting';

const router = Router();

router.use(healthRouter);
router.use('/auth', authRouter);
router.use('/users', userManagementRouter);
router.use('/menu-items', menuItemsRouter);
router.use('/menu-categories', menuCategoriesRouter);
router.use('/recipes', recipeRouter);
router.use('/settings', settingsRouter);
router.use('/discounts', discountsRouter);
router.use('/sync', syncRouter);
router.use(inventoryRouter);
router.use(orderManagementRouter);
router.use(kitchenRouter);
router.use(paymentRouter);
router.use(shiftManagementRouter);
router.use(reportingRouter);

export default router;
