// ============================================================
// Enums and State Machine Types — derived from entities.json
// ============================================================

// --- Shared Sync Status (used by all entities) ---
export const SYNC_STATUSES = ['synced', 'pending', 'conflict'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

// --- Entity: User (E-001) ---
export const USER_ROLES = ['owner', 'waiter-cashier', 'chef'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// --- Entity: Recipe (E-005) ---
export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

// --- Entity: InventoryItem (E-008) — State Machine ---
export const STOCK_STATUSES = ['ok', 'low', 'critical'] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const STOCK_STATUS_TRANSITIONS: Record<StockStatus, StockStatus[]> = {
  ok: ['low'],
  low: ['critical', 'ok'],
  critical: ['ok', 'low'],
};

// --- Entity: StockMovement (E-009) ---
export const MOVEMENT_TYPES = ['restock', 'auto_deduction', 'manual_adjustment'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

// --- Entity: Table (E-010) — State Machine ---
export const TABLE_STATUSES = ['available', 'occupied', 'needs_payment'] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const TABLE_STATUS_TRANSITIONS: Record<TableStatus, TableStatus[]> = {
  available: ['occupied'],
  occupied: ['needs_payment', 'available'],
  needs_payment: ['available'],
};

// --- Entity: Order (E-011) — State Machine ---
export const ORDER_STATUSES = ['pending', 'cooking', 'ready', 'served', 'paid', 'cancelled', 'voided'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['cooking', 'cancelled'],
  cooking: ['ready'],
  ready: ['served'],
  served: ['paid'],
  paid: ['voided'],
  cancelled: [],
  voided: [],
};

// --- Entity: OrderItem (E-012) — State Machine ---
export const COOKING_STATUSES = ['pending', 'cooking', 'ready', 'served'] as const;
export type CookingStatus = (typeof COOKING_STATUSES)[number];

export const COOKING_STATUS_TRANSITIONS: Record<CookingStatus, CookingStatus[]> = {
  pending: ['cooking'],
  cooking: ['ready'],
  ready: ['served'],
  served: [],
};

// --- Entity: Transaction (E-013) ---
export const PAYMENT_METHODS = ['tunai', 'qris', 'gopay', 'ovo', 'dana', 'shopeepay', 'transfer_bank'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// --- Entity: Transaction (E-013) — State Machine ---
export const TRANSACTION_STATUSES = ['completed', 'voided'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_STATUS_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  completed: ['voided'],
  voided: [],
};

// --- Entity: Shift (E-014) — State Machine ---
export const SHIFT_STATUSES = ['open', 'closed'] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

export const SHIFT_STATUS_TRANSITIONS: Record<ShiftStatus, ShiftStatus[]> = {
  open: ['closed'],
  closed: [],
};

// --- Entity: VoidRecord (E-015) ---
export const VOID_TYPES = ['full_void', 'partial_void', 'cancel_before_payment'] as const;
export type VoidType = (typeof VOID_TYPES)[number];

export const VOID_REASONS = ['salah_input', 'customer_batal', 'item_habis', 'lainnya'] as const;
export type VoidReason = (typeof VOID_REASONS)[number];

// --- Entity: Discount (E-016) ---
export const DISCOUNT_TYPES = ['percentage', 'fixed_amount'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DISCOUNT_APPLIED_TO = ['whole_order', 'specific_items'] as const;
export type DiscountAppliedTo = (typeof DISCOUNT_APPLIED_TO)[number];
