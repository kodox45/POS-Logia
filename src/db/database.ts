// ============================================================
// Dexie Database — Primary offline-first data store
// All 19 entity tables defined with indexes
// ============================================================

import Dexie, { type EntityTable } from 'dexie';
import type {
  User,
  UserPermission,
  MenuItem,
  MenuCategory,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  InventoryItem,
  StockMovement,
  Table,
  Order,
  OrderItem,
  Transaction,
  Shift,
  VoidRecord,
  Discount,
  KitchenNotification,
  PosSettings,
  EwalletProvider,
} from '@/types';

class LogiaPosDB extends Dexie {
  users!: EntityTable<User, 'id'>;
  userPermissions!: EntityTable<UserPermission, 'id'>;
  menuItems!: EntityTable<MenuItem, 'id'>;
  menuCategories!: EntityTable<MenuCategory, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  recipeIngredients!: EntityTable<RecipeIngredient, 'id'>;
  recipeSteps!: EntityTable<RecipeStep, 'id'>;
  inventoryItems!: EntityTable<InventoryItem, 'id'>;
  stockMovements!: EntityTable<StockMovement, 'id'>;
  restaurantTables!: EntityTable<Table, 'id'>;
  orders!: EntityTable<Order, 'id'>;
  orderItems!: EntityTable<OrderItem, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  shifts!: EntityTable<Shift, 'id'>;
  voidRecords!: EntityTable<VoidRecord, 'id'>;
  discounts!: EntityTable<Discount, 'id'>;
  kitchenNotifications!: EntityTable<KitchenNotification, 'id'>;
  posSettings!: EntityTable<PosSettings, 'id'>;
  ewalletProviders!: EntityTable<EwalletProvider, 'id'>;

  constructor() {
    super('LogiaPosDB');

    this.version(1).stores({
      // E-001: User
      users: 'id, &username, role, isActive, &syncId, syncStatus',
      // E-002: UserPermission
      userPermissions: 'id, userId, [userId+permissionKey], &syncId, syncStatus',
      // E-003: MenuItem
      menuItems: 'id, categoryId, isAvailable, itemName, &syncId, syncStatus',
      // E-004: MenuCategory
      menuCategories: 'id, &name, &syncId, syncStatus',
      // E-005: Recipe
      recipes: 'id, menuItemId, &syncId, syncStatus',
      // E-006: RecipeIngredient
      recipeIngredients: 'id, recipeId, inventoryItemId, [recipeId+inventoryItemId], &syncId, syncStatus',
      // E-007: RecipeStep
      recipeSteps: 'id, [recipeId+stepOrder], &syncId, syncStatus',
      // E-008: InventoryItem
      inventoryItems: 'id, &itemName, stockStatus, &syncId, syncStatus',
      // E-009: StockMovement
      stockMovements: 'id, inventoryItemId, movementType, createdAt, &syncId, syncStatus',
      // E-010: Table (named 'restaurantTables' to avoid collision with Dexie.tables)
      restaurantTables: 'id, &tableNumber, status, &syncId, syncStatus',
      // E-011: Order
      orders: 'id, &orderNumber, tableId, orderStatus, shiftId, createdAt, &syncId, syncStatus',
      // E-012: OrderItem
      orderItems: 'id, orderId, menuItemId, &syncId, syncStatus',
      // E-013: Transaction
      transactions: 'id, &transactionNumber, orderId, shiftId, cashierId, paymentMethod, createdAt, &syncId, syncStatus',
      // E-014: Shift
      shifts: 'id, &shiftNumber, picCashierId, shiftStatus, shiftStartTime, &syncId, syncStatus',
      // E-015: VoidRecord
      voidRecords: 'id, &voidNumber, originalOrderId, shiftId, voidedBy, createdAt, &syncId, syncStatus',
      // E-016: Discount
      discounts: 'id, isActive, &syncId, syncStatus',
      // E-017: KitchenNotification
      kitchenNotifications: 'id, orderId, isAcknowledged, &syncId, syncStatus',
      // E-018: PosSettings
      posSettings: 'id, &syncId, syncStatus',
      // E-019: EwalletProvider
      ewalletProviders: 'id, &providerName, isEnabled, &syncId, syncStatus',
    });
  }
}

export const db = new LogiaPosDB();
