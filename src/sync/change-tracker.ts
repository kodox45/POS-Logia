// ============================================================
// Change Tracker — Monitors IndexedDB changes and queues them
// Uses a dedicated Dexie table for the outbound change queue
// ============================================================

import Dexie from 'dexie';
import { db } from '@/db/database';
import type { ChangeRecord, TableName, SyncableEntity } from './types';
import { ALL_SYNCABLE_TABLES } from './types';

class ChangeQueueDB extends Dexie {
  changeQueue!: Dexie.Table<ChangeRecord, string>;

  constructor() {
    super('LogiaPOS_ChangeQueue');
    this.version(1).stores({
      changeQueue: 'id, tableName, syncId, timestamp, retryCount',
    });
  }
}

export const changeQueueDb = new ChangeQueueDB();

function generateId(): string {
  return `chg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function trackChange(
  tableName: TableName,
  operation: 'create' | 'update' | 'delete',
  data: SyncableEntity
): Promise<void> {
  const record: ChangeRecord = {
    id: generateId(),
    tableName,
    recordId: data.id,
    syncId: data.syncId,
    operation,
    timestamp: new Date().toISOString(),
    data,
    retryCount: 0,
  };

  await changeQueueDb.changeQueue.put(record);
}

export async function getPendingChanges(): Promise<ChangeRecord[]> {
  return changeQueueDb.changeQueue
    .orderBy('timestamp')
    .toArray();
}

export async function getPendingCount(): Promise<number> {
  return changeQueueDb.changeQueue.count();
}

export async function removeChanges(changeIds: string[]): Promise<void> {
  await changeQueueDb.changeQueue.bulkDelete(changeIds);
}

export async function incrementRetryCount(changeId: string): Promise<void> {
  const existing = await changeQueueDb.changeQueue.get(changeId);
  const currentCount = existing?.retryCount ?? 0;
  await changeQueueDb.changeQueue.update(changeId, {
    retryCount: currentCount + 1,
  });
}

export async function getChangesByTable(tableName: TableName): Promise<ChangeRecord[]> {
  return changeQueueDb.changeQueue
    .where('tableName')
    .equals(tableName)
    .sortBy('timestamp');
}

export async function clearAllChanges(): Promise<void> {
  await changeQueueDb.changeQueue.clear();
}

export function getTableRef(tableName: TableName) {
  return db.table(tableName);
}

export async function markRecordSynced(
  tableName: TableName,
  recordId: string
): Promise<void> {
  const table = getTableRef(tableName);
  await table.update(recordId, {
    syncStatus: 'synced' as const,
    lastSynced: new Date().toISOString(),
  });
}

export async function markRecordPending(
  tableName: TableName,
  recordId: string
): Promise<void> {
  const table = getTableRef(tableName);
  await table.update(recordId, {
    syncStatus: 'pending' as const,
  });
}

export async function markRecordConflict(
  tableName: TableName,
  recordId: string
): Promise<void> {
  const table = getTableRef(tableName);
  await table.update(recordId, {
    syncStatus: 'conflict' as const,
  });
}

export async function collectUnsyncedRecords(): Promise<ChangeRecord[]> {
  const changes: ChangeRecord[] = [];

  for (const tableName of ALL_SYNCABLE_TABLES) {
    const table = getTableRef(tableName);
    const unsynced = await table
      .where('syncStatus')
      .equals('pending')
      .toArray();

    for (const record of unsynced) {
      const entity = record as SyncableEntity;
      changes.push({
        id: generateId(),
        tableName,
        recordId: entity.id,
        syncId: entity.syncId,
        operation: entity.lastSynced ? 'update' : 'create',
        timestamp: entity.updatedAt,
        data: entity,
        retryCount: 0,
      });
    }
  }

  return changes.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}
