// ============================================================
// Entity Interfaces — derived from entities.json
// ============================================================

import type {
  SyncStatus,
  UserRole,
  DifficultyLevel,
  StockStatus,
  MovementType,
  TableStatus,
  OrderStatus,
  CookingStatus,
  PaymentMethod,
  TransactionStatus,
  ShiftStatus,
  VoidType,
  VoidReason,
  DiscountType,
  DiscountAppliedTo,
} from './enums';

// Entity: E-001 — User
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  pinHash?: string;
  role: UserRole;
  displayName: string;
  isActive: boolean;
  lastLoginAt?: string;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  permissions?: UserPermission[];
  shifts?: Shift[];
  orders?: Order[];
}

// Entity: E-002 — UserPermission
export interface UserPermission {
  id: string;
  userId: string;
  permissionKey: string;
  isGranted: boolean;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  user?: User;
}

// Entity: E-003 — MenuItem
export interface MenuItem {
  id: string;
  itemName: string;
  price: number; // Stored as cents/smallest unit to avoid floating point
  categoryId: string;
  description?: string;
  isAvailable: boolean;
  imageUrl?: string;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  category?: MenuCategory;
  recipes?: Recipe[];
  orderItems?: OrderItem[];
}

// Entity: E-004 — MenuCategory
export interface MenuCategory {
  id: string;
  name: string;
  sortOrder?: number;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  menuItems?: MenuItem[];
}

// Entity: E-005 — Recipe
export interface Recipe {
  id: string;
  menuItemId: string;
  cookingTime?: number;
  difficultyLevel?: DifficultyLevel;
  notes?: string;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  menuItem?: MenuItem;
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
}

// Entity: E-006 — RecipeIngredient
export interface RecipeIngredient {
  id: string;
  recipeId: string;
  inventoryItemId: string;
  quantityRequired: number;
  unit: string;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  recipe?: Recipe;
  inventoryItem?: InventoryItem;
}

// Entity: E-007 — RecipeStep
export interface RecipeStep {
  id: string;
  recipeId: string;
  stepOrder: number;
  instruction: string;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  recipe?: Recipe;
}

// Entity: E-008 — InventoryItem
export interface InventoryItem {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  minimumThreshold?: number;
  stockStatus: StockStatus;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  recipeIngredients?: RecipeIngredient[];
  stockMovements?: StockMovement[];
}

// Entity: E-009 — StockMovement
export interface StockMovement {
  id: string;
  inventoryItemId: string;
  movementType: MovementType;
  quantityChange: number;
  reason?: string;
  orderId?: string;
  performedBy: string;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  inventoryItem?: InventoryItem;
  order?: Order;
  performer?: User;
}

// Entity: E-010 — Table
export interface Table {
  id: string;
  tableName: string;
  tableNumber: number;
  capacity?: number;
  status: TableStatus;
  activeOrderId?: string;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  orders?: Order[];
}

// Entity: E-011 — Order
export interface Order {
  id: string;
  orderNumber: string;
  tableId: string;
  waiterId: string;
  shiftId?: string;
  orderStatus: OrderStatus;
  specialNotes?: string;
  isAdditional?: boolean;
  discountId?: string;
  discountAmount?: number; // Stored as cents/smallest unit to avoid floating point
  subtotalAmount: number; // Stored as cents/smallest unit to avoid floating point
  ppnRate: number;
  ppnAmount: number; // Stored as cents/smallest unit to avoid floating point
  grandTotal: number; // Stored as cents/smallest unit to avoid floating point
  cookingStartedAt?: string;
  readyAt?: string;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  table?: Table;
  waiter?: User;
  shift?: Shift;
  discount?: Discount;
  items?: OrderItem[];
  transactions?: Transaction[];
  voidRecords?: VoidRecord[];
  kitchenNotifications?: KitchenNotification[];
}

// Entity: E-012 — OrderItem
export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number; // Stored as cents/smallest unit to avoid floating point
  lineTotal: number; // Stored as cents/smallest unit to avoid floating point
  specialNotes?: string;
  isAdditional?: boolean;
  cookingStatus: CookingStatus;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  order?: Order;
  menuItem?: MenuItem;
}

// Entity: E-013 — Transaction
export interface Transaction {
  id: string;
  transactionNumber: string;
  orderId: string;
  shiftId: string;
  cashierId: string;
  tableNumber: number;
  subtotalAmount: number; // Stored as cents/smallest unit to avoid floating point
  discountName?: string;
  discountAmount?: number; // Stored as cents/smallest unit to avoid floating point
  ppnRate: number;
  ppnAmount: number; // Stored as cents/smallest unit to avoid floating point
  grandTotal: number; // Stored as cents/smallest unit to avoid floating point
  paymentMethod: PaymentMethod;
  digitalPaymentRef?: string;
  transferProofPhotoUrl?: string;
  amountPaid: number; // Stored as cents/smallest unit to avoid floating point
  changeAmount: number; // Stored as cents/smallest unit to avoid floating point
  transactionStatus: TransactionStatus;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  order?: Order;
  shift?: Shift;
  cashier?: User;
}

// Entity: E-014 — Shift
export interface Shift {
  id: string;
  shiftNumber: string;
  picCashierId: string;
  pinVerified: boolean;
  pinVerifiedAt?: string;
  openingBalance: number; // Stored as cents/smallest unit to avoid floating point
  shiftStartTime: string;
  shiftEndTime?: string;
  expectedCash: number; // Stored as cents/smallest unit to avoid floating point
  actualCash?: number; // Stored as cents/smallest unit to avoid floating point
  discrepancy?: number; // Stored as cents/smallest unit to avoid floating point
  digitalSalesTotal: number; // Stored as cents/smallest unit to avoid floating point
  cashSalesTotal: number; // Stored as cents/smallest unit to avoid floating point
  totalRevenue: number; // Stored as cents/smallest unit to avoid floating point
  totalTransactions: number;
  voidCount: number;
  voidTotalAmount: number; // Stored as cents/smallest unit to avoid floating point
  discountTotalGiven: number; // Stored as cents/smallest unit to avoid floating point
  shiftStatus: ShiftStatus;
  closingNotes?: string;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  cashier?: User;
  transactions?: Transaction[];
  orders?: Order[];
  voidRecords?: VoidRecord[];
}

// Entity: E-015 — VoidRecord
export interface VoidRecord {
  id: string;
  voidNumber: string;
  originalOrderId: string;
  shiftId: string;
  voidType: VoidType;
  voidReason: VoidReason;
  voidNotes?: string;
  voidedBy: string;
  pinVerified: boolean;
  pinVerifiedAt: string;
  voidAmount: number; // Stored as cents/smallest unit to avoid floating point
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  originalOrder?: Order;
  shift?: Shift;
  performer?: User;
}

// Entity: E-016 — Discount
export interface Discount {
  id: string;
  discountName: string;
  discountType: DiscountType;
  discountValue: number;
  appliedTo: DiscountAppliedTo;
  isActive: boolean;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  orders?: Order[];
}

// Entity: E-017 — KitchenNotification
export interface KitchenNotification {
  id: string;
  orderId: string;
  tableNumber: number;
  items: string;
  isAcknowledged: boolean;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  order?: Order;
}

// Entity: E-018 — PosSettings
export interface PosSettings {
  id: string;
  ppnEnabled: boolean;
  ppnRate: number;
  restaurantName?: string;
  restaurantAddress?: string;
  receiptFooter?: string;
  showPpnOnReceipt: boolean;
  qrisImageUrl?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  restaurantLogoUrl?: string;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  ewalletProviders?: EwalletProvider[];
}

// Entity: E-019 — EwalletProvider
export interface EwalletProvider {
  id: string;
  posSettingsId: string;
  providerName: string;
  isEnabled: boolean;
  qrImageUrl?: string;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  // Relationships
  posSettings?: PosSettings;
}
