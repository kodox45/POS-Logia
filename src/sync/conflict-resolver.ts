// ============================================================
// Conflict Resolver — Applies resolution strategies
// - Last-write-wins for most entities
// - Append-only for financial records (Transaction, Shift, VoidRecord)
// ============================================================

import type {
  ConflictRecord,
  ConflictResolution,
  ConflictResolutionStrategy,
  SyncableEntity,
  TableName,
} from './types';
import { APPEND_ONLY_TABLES } from './types';
import { getTableRef, markRecordSynced, markRecordConflict } from './change-tracker';

function getStrategy(tableName: TableName): ConflictResolutionStrategy {
  if (APPEND_ONLY_TABLES.includes(tableName)) {
    return 'append-only';
  }
  return 'last-write-wins';
}

function resolveLastWriteWins(conflict: ConflictRecord): ConflictResolution {
  const localTime = new Date(conflict.localUpdatedAt).getTime();
  const serverTime = new Date(conflict.serverUpdatedAt).getTime();

  const winner = localTime >= serverTime ? 'local' : 'server';
  const resolvedData = winner === 'local' ? conflict.localData : conflict.serverData;

  return {
    conflictId: conflict.changeId,
    strategy: 'last-write-wins',
    winner,
    resolvedData: {
      ...resolvedData,
      syncStatus: 'synced',
      lastSynced: new Date().toISOString(),
    },
  };
}

function resolveAppendOnly(conflict: ConflictRecord): ConflictResolution {
  // For append-only tables (Transaction, Shift, VoidRecord),
  // server version always wins — financial records must not be overwritten locally.
  // The local version should have been pushed as a new record, not an update.
  return {
    conflictId: conflict.changeId,
    strategy: 'append-only',
    winner: 'server',
    resolvedData: {
      ...conflict.serverData,
      syncStatus: 'synced',
      lastSynced: new Date().toISOString(),
    },
  };
}

export function resolveConflict(conflict: ConflictRecord): ConflictResolution {
  const strategy = getStrategy(conflict.tableName);

  switch (strategy) {
    case 'append-only':
      return resolveAppendOnly(conflict);
    case 'last-write-wins':
    default:
      return resolveLastWriteWins(conflict);
  }
}

export function resolveConflicts(conflicts: ConflictRecord[]): ConflictResolution[] {
  return conflicts.map(resolveConflict);
}

export async function applyResolution(
  resolution: ConflictResolution,
  tableName: TableName,
  recordId: string
): Promise<void> {
  const table = getTableRef(tableName);
  await table.put(resolution.resolvedData);
  await markRecordSynced(tableName, recordId);
}

export async function applyResolutions(
  resolutions: ConflictResolution[],
  conflicts: ConflictRecord[]
): Promise<void> {
  for (let i = 0; i < resolutions.length; i++) {
    const resolution = resolutions[i];
    const conflict = conflicts[i];
    await applyResolution(resolution, conflict.tableName, conflict.recordId);
  }
}

export async function applyServerChanges(
  tableName: TableName,
  recordId: string,
  data: SyncableEntity
): Promise<void> {
  const table = getTableRef(tableName);
  const existing = await table.get(recordId);

  if (!existing) {
    // New record from server — insert directly
    await table.put({
      ...data,
      syncStatus: 'synced',
      lastSynced: new Date().toISOString(),
    });
    return;
  }

  const existingEntity = existing as SyncableEntity;

  // Check if local has unsynced changes
  if (existingEntity.syncStatus === 'pending') {
    const strategy = getStrategy(tableName);

    if (strategy === 'append-only') {
      // Server wins for financial records
      await table.put({
        ...data,
        syncStatus: 'synced',
        lastSynced: new Date().toISOString(),
      });
    } else {
      // Last-write-wins: compare timestamps
      const localTime = new Date(existingEntity.updatedAt).getTime();
      const serverTime = new Date(data.updatedAt).getTime();

      if (serverTime >= localTime) {
        await table.put({
          ...data,
          syncStatus: 'synced',
          lastSynced: new Date().toISOString(),
        });
      } else {
        // Local is newer — keep local, mark as pending for next push
        await markRecordConflict(tableName, recordId);
      }
    }
  } else {
    // No local conflict — apply server version
    await table.put({
      ...data,
      syncStatus: 'synced',
      lastSynced: new Date().toISOString(),
    });
  }
}
