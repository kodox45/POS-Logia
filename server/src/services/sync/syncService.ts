import prisma from '../../prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';

// Tables that use append-only sync (financial records)
const APPEND_ONLY_ENTITIES = ['Transaction', 'Shift', 'VoidRecord'];

// Map from client entity names to Prisma model delegates
type PrismaDelegate = {
  findUnique: (args: any) => Promise<any>;
  upsert: (args: any) => Promise<any>;
  findMany: (args: any) => Promise<any>;
  count: (args: any) => Promise<number>;
};

function getModelDelegate(entity: string): PrismaDelegate {
  const map: Record<string, PrismaDelegate> = {
    User: prisma.user,
    UserPermission: prisma.userPermission,
    MenuItem: prisma.menuItem,
    MenuCategory: prisma.menuCategory,
    Recipe: prisma.recipe,
    RecipeIngredient: prisma.recipeIngredient,
    RecipeStep: prisma.recipeStep,
    InventoryItem: prisma.inventoryItem,
    StockMovement: prisma.stockMovement,
    RestaurantTable: prisma.restaurantTable,
    Order: prisma.order,
    OrderItem: prisma.orderItem,
    Transaction: prisma.transaction,
    Shift: prisma.shift,
    VoidRecord: prisma.voidRecord,
    Discount: prisma.discount,
    KitchenNotification: prisma.kitchenNotification,
    PosSettings: prisma.posSettings,
    EwalletProvider: prisma.ewalletProvider,
  };

  const delegate = map[entity];
  if (!delegate) {
    throw new AppError(400, 'INVALID_ENTITY', `Unknown entity: ${entity}`);
  }
  return delegate;
}

interface SyncChange {
  id?: string;
  entity: string;
  syncId: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, any>;
  timestamp: string;
}

interface SyncConflict {
  syncId: string;
  entity: string;
  conflictType: string;
  serverVersion: Record<string, any>;
}

export async function pushChanges(
  changes: SyncChange[],
  _deviceId: string,
): Promise<{ synced: number; conflicts: SyncConflict[]; syncedAt: string }> {
  let synced = 0;
  const conflicts: SyncConflict[] = [];
  const now = new Date();

  for (const change of changes) {
    const delegate = getModelDelegate(change.entity);

    try {
      if (change.operation === 'delete') {
        const existing = await delegate.findUnique({ where: { syncId: change.syncId } });
        if (existing) {
          // Soft-delete not implemented; skip deletes for append-only
          if (APPEND_ONLY_ENTITIES.includes(change.entity)) {
            conflicts.push({
              syncId: change.syncId,
              entity: change.entity,
              conflictType: 'append_only_no_delete',
              serverVersion: existing,
            });
            continue;
          }
        }
        synced++;
        continue;
      }

      const existing = await delegate.findUnique({ where: { syncId: change.syncId } });

      if (existing) {
        // Record exists on server -- check for conflict
        if (APPEND_ONLY_ENTITIES.includes(change.entity)) {
          // Append-only: server version always wins on update conflicts
          const serverUpdatedAt = new Date(existing.updatedAt).getTime();
          const clientUpdatedAt = new Date(change.timestamp).getTime();

          if (clientUpdatedAt < serverUpdatedAt) {
            conflicts.push({
              syncId: change.syncId,
              entity: change.entity,
              conflictType: 'append_only_server_wins',
              serverVersion: sanitizeRecord(existing),
            });
            continue;
          }
        }

        // Last-write-wins for non-append-only entities
        const serverUpdatedAt = new Date(existing.updatedAt).getTime();
        const clientUpdatedAt = new Date(change.timestamp).getTime();

        if (clientUpdatedAt < serverUpdatedAt) {
          // Server is newer -- conflict, return server version
          conflicts.push({
            syncId: change.syncId,
            entity: change.entity,
            conflictType: 'last_write_wins_server_newer',
            serverVersion: sanitizeRecord(existing),
          });
          continue;
        }

        // Client is newer or equal -- apply update
        const updateData = prepareData(change.data, change.entity);
        await delegate.upsert({
          where: { syncId: change.syncId },
          update: {
            ...updateData,
            syncStatus: 'synced',
            lastSynced: now,
          },
          create: {
            ...updateData,
            syncId: change.syncId,
            syncStatus: 'synced',
            lastSynced: now,
          },
        });
        synced++;
      } else {
        // New record -- create
        const createData = prepareData(change.data, change.entity);
        await delegate.upsert({
          where: { syncId: change.syncId },
          update: {
            ...createData,
            syncStatus: 'synced',
            lastSynced: now,
          },
          create: {
            ...createData,
            syncId: change.syncId,
            syncStatus: 'synced',
            lastSynced: now,
          },
        });
        synced++;
      }
    } catch (error) {
      // Log but continue processing other changes
      console.error(`Sync error for ${change.entity} (${change.syncId}):`, error);
      conflicts.push({
        syncId: change.syncId,
        entity: change.entity,
        conflictType: 'processing_error',
        serverVersion: {},
      });
    }
  }

  return {
    synced,
    conflicts,
    syncedAt: now.toISOString(),
  };
}

export async function pullChanges(
  lastSyncedAt: string,
  _deviceId: string,
): Promise<{
  changes: Array<{
    entity: string;
    syncId: string;
    operation: 'create' | 'update';
    data: Record<string, any>;
    timestamp: string;
  }>;
  totalChanges: number;
  syncedAt: string;
}> {
  const since = new Date(lastSyncedAt);
  const now = new Date();
  const allChanges: Array<{
    entity: string;
    syncId: string;
    operation: 'create' | 'update';
    data: Record<string, any>;
    timestamp: string;
  }> = [];

  const entities = [
    'User', 'UserPermission', 'MenuItem', 'MenuCategory',
    'Recipe', 'RecipeIngredient', 'RecipeStep',
    'InventoryItem', 'StockMovement', 'RestaurantTable',
    'Order', 'OrderItem', 'Transaction', 'Shift',
    'VoidRecord', 'Discount', 'KitchenNotification',
    'PosSettings', 'EwalletProvider',
  ];

  for (const entity of entities) {
    const delegate = getModelDelegate(entity);
    const records = await delegate.findMany({
      where: {
        updatedAt: { gt: since },
      },
      orderBy: { updatedAt: 'asc' },
    });

    for (const record of records) {
      allChanges.push({
        entity,
        syncId: record.syncId,
        operation: new Date(record.createdAt).getTime() > since.getTime() ? 'create' : 'update',
        data: sanitizeRecord(record),
        timestamp: record.updatedAt.toISOString(),
      });
    }
  }

  // Sort all changes by timestamp
  allChanges.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return {
    changes: allChanges,
    totalChanges: allChanges.length,
    syncedAt: now.toISOString(),
  };
}

export async function getSyncStatus(): Promise<{
  online: boolean;
  lastSyncedAt: string | null;
  pendingChanges: number;
  conflicts: number;
}> {
  const entities = [
    'User', 'UserPermission', 'MenuItem', 'MenuCategory',
    'Recipe', 'RecipeIngredient', 'RecipeStep',
    'InventoryItem', 'StockMovement', 'RestaurantTable',
    'Order', 'OrderItem', 'Transaction', 'Shift',
    'VoidRecord', 'Discount', 'KitchenNotification',
    'PosSettings', 'EwalletProvider',
  ];

  let pendingCount = 0;
  let conflictCount = 0;

  for (const entity of entities) {
    const delegate = getModelDelegate(entity);
    const pending = await delegate.count({ where: { syncStatus: 'pending' } });
    const conflict = await delegate.count({ where: { syncStatus: 'conflict' } });
    pendingCount += pending;
    conflictCount += conflict;
  }

  return {
    online: true,
    lastSyncedAt: null,
    pendingChanges: pendingCount,
    conflicts: conflictCount,
  };
}

function sanitizeRecord(record: any): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value instanceof Date) {
      sanitized[key] = value.toISOString();
    } else if (value instanceof Prisma.Decimal) {
      sanitized[key] = value.toNumber();
    } else if (value !== undefined) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function prepareData(data: Record<string, any>, entity: string): Record<string, any> {
  const prepared: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip relation fields and sync metadata (managed by the sync system)
    if (key === 'syncId' || key === 'syncStatus' || key === 'lastSynced') continue;

    // Skip nested relation objects
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      continue;
    }

    // Skip array relations
    if (Array.isArray(value)) continue;

    // Convert ISO date strings to Date objects for DateTime fields
    if (typeof value === 'string' && isISODateString(value)) {
      prepared[key] = new Date(value);
    } else {
      prepared[key] = value;
    }
  }

  return prepared;
}

function isISODateString(str: string): boolean {
  if (str.length < 10) return false;
  const date = new Date(str);
  return !isNaN(date.getTime()) && str.includes('T');
}
