// ============================================================
// Sync Types — Shared types for sync infrastructure
// ============================================================

import type { SyncStatus } from '@/types/enums';

export interface SyncableEntity {
  id: string;
  syncId: string;
  lastSynced?: string;
  syncStatus: SyncStatus;
  updatedAt: string;
  createdAt: string;
}

export type TableName =
  | 'users'
  | 'userPermissions'
  | 'menuItems'
  | 'menuCategories'
  | 'recipes'
  | 'recipeIngredients'
  | 'recipeSteps'
  | 'inventoryItems'
  | 'stockMovements'
  | 'restaurantTables'
  | 'orders'
  | 'orderItems'
  | 'transactions'
  | 'shifts'
  | 'voidRecords'
  | 'discounts'
  | 'kitchenNotifications'
  | 'posSettings'
  | 'ewalletProviders';

export const APPEND_ONLY_TABLES: TableName[] = [
  'transactions',
  'shifts',
  'voidRecords',
];

export const ALL_SYNCABLE_TABLES: TableName[] = [
  'users',
  'userPermissions',
  'menuItems',
  'menuCategories',
  'recipes',
  'recipeIngredients',
  'recipeSteps',
  'inventoryItems',
  'stockMovements',
  'restaurantTables',
  'orders',
  'orderItems',
  'transactions',
  'shifts',
  'voidRecords',
  'discounts',
  'kitchenNotifications',
  'posSettings',
  'ewalletProviders',
];

export interface ChangeRecord {
  id: string;
  tableName: TableName;
  recordId: string;
  syncId: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: string;
  data: SyncableEntity;
  retryCount: number;
}

export interface SyncBatch {
  batchId: string;
  changes: ChangeRecord[];
  createdAt: string;
}

export interface SyncPullResponse {
  changes: ServerChange[];
  serverTimestamp: string;
  hasMore: boolean;
}

export interface ServerChange {
  tableName: TableName;
  recordId: string;
  syncId: string;
  operation: 'create' | 'update' | 'delete';
  data: SyncableEntity;
  serverUpdatedAt: string;
}

export interface SyncPushResponse {
  accepted: string[];
  conflicts: ConflictRecord[];
  serverTimestamp: string;
}

export interface ConflictRecord {
  changeId: string;
  tableName: TableName;
  recordId: string;
  syncId: string;
  localData: SyncableEntity;
  serverData: SyncableEntity;
  localUpdatedAt: string;
  serverUpdatedAt: string;
}

export type ConflictResolutionStrategy = 'last-write-wins' | 'append-only' | 'manual';

export interface ConflictResolution {
  conflictId: string;
  strategy: ConflictResolutionStrategy;
  winner: 'local' | 'server';
  resolvedData: SyncableEntity;
}

export type SyncEngineStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncProgress {
  status: SyncEngineStatus;
  lastSyncedAt: string | null;
  pendingChanges: number;
  currentBatch: number;
  totalBatches: number;
  error: string | null;
}

export const SYNC_BATCH_SIZE = 50;
export const SYNC_RETRY_MAX = 3;
export const SYNC_INTERVAL_MS = 30_000;
export const SYNC_DEBOUNCE_MS = 2_000;
