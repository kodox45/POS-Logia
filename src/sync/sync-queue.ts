// ============================================================
// Sync Queue — Batched push/pull of IndexedDB changes
// Handles batching, retry logic, and queue management
// ============================================================

import axios from 'axios';
import type {
  ChangeRecord,
  SyncBatch,
  SyncPushResponse,
  SyncPullResponse,
  SyncProgress,
} from './types';
import { SYNC_BATCH_SIZE, SYNC_RETRY_MAX } from './types';
import {
  getPendingChanges,
  removeChanges,
  getPendingCount,
  collectUnsyncedRecords,
  markRecordSynced,
} from './change-tracker';
import {
  resolveConflicts,
  applyResolutions,
  applyServerChanges,
} from './conflict-resolver';

const API_BASE = '/api/sync';

function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createBatches(changes: ChangeRecord[]): SyncBatch[] {
  const batches: SyncBatch[] = [];
  for (let i = 0; i < changes.length; i += SYNC_BATCH_SIZE) {
    batches.push({
      batchId: generateBatchId(),
      changes: changes.slice(i, i + SYNC_BATCH_SIZE),
      createdAt: new Date().toISOString(),
    });
  }
  return batches;
}

export async function pushBatch(
  batch: SyncBatch,
  onProgress?: (progress: Partial<SyncProgress>) => void
): Promise<SyncPushResponse> {
  const response = await axios.post<SyncPushResponse>(`${API_BASE}/push`, {
    batchId: batch.batchId,
    changes: batch.changes.map((c) => ({
      id: c.id,
      tableName: c.tableName,
      recordId: c.recordId,
      syncId: c.syncId,
      operation: c.operation,
      data: c.data,
      timestamp: c.timestamp,
    })),
  });

  const result = response.data;

  // Remove accepted changes from the queue
  if (result.accepted.length > 0) {
    const acceptedChanges = batch.changes.filter((c) =>
      result.accepted.includes(c.id)
    );
    await removeChanges(acceptedChanges.map((c) => c.id));

    // Mark accepted records as synced in the main DB
    for (const change of acceptedChanges) {
      await markRecordSynced(change.tableName, change.recordId);
    }
  }

  // Resolve conflicts
  if (result.conflicts.length > 0) {
    const resolutions = resolveConflicts(result.conflicts);
    await applyResolutions(resolutions, result.conflicts);

    // Remove conflict changes from queue (resolved)
    const conflictChangeIds = result.conflicts.map((c) => c.changeId);
    await removeChanges(conflictChangeIds);
  }

  return result;
}

export async function pullChanges(
  lastSyncTimestamp: string | null,
  onProgress?: (progress: Partial<SyncProgress>) => void
): Promise<string> {
  let cursor = lastSyncTimestamp;
  let hasMore = true;

  while (hasMore) {
    const response = await axios.get<SyncPullResponse>(`${API_BASE}/pull`, {
      params: {
        since: cursor,
        limit: SYNC_BATCH_SIZE,
      },
    });

    const result = response.data;

    // Apply each server change to local DB
    for (const change of result.changes) {
      if (change.operation === 'delete') {
        // For deletes, we could soft-delete or remove
        // For now, apply server changes which handles conflicts
        await applyServerChanges(
          change.tableName,
          change.recordId,
          change.data
        );
      } else {
        await applyServerChanges(
          change.tableName,
          change.recordId,
          change.data
        );
      }
    }

    cursor = result.serverTimestamp;
    hasMore = result.hasMore;
  }

  return cursor ?? new Date().toISOString();
}

export async function executePushPull(
  lastSyncTimestamp: string | null,
  onProgress?: (progress: Partial<SyncProgress>) => void
): Promise<string> {
  // Phase 1: Collect all unsynced records and queue changes
  const unsyncedFromDb = await collectUnsyncedRecords();
  const queuedChanges = await getPendingChanges();

  // Merge: queue takes precedence, add unsynced records not already queued
  const queuedSyncIds = new Set(queuedChanges.map((c) => `${c.tableName}:${c.recordId}`));
  const allChanges = [
    ...queuedChanges,
    ...unsyncedFromDb.filter(
      (c) => !queuedSyncIds.has(`${c.tableName}:${c.recordId}`)
    ),
  ];

  // Phase 2: Push local changes in batches
  if (allChanges.length > 0) {
    const batches = createBatches(allChanges);
    for (let i = 0; i < batches.length; i++) {
      onProgress?.({
        status: 'syncing',
        currentBatch: i + 1,
        totalBatches: batches.length,
      });

      let retryCount = 0;
      let success = false;

      while (retryCount < SYNC_RETRY_MAX && !success) {
        try {
          await pushBatch(batches[i], onProgress);
          success = true;
        } catch (error) {
          retryCount++;
          if (retryCount >= SYNC_RETRY_MAX) {
            throw new Error(
              `Push failed after ${SYNC_RETRY_MAX} retries for batch ${batches[i].batchId}`
            );
          }
          // Wait before retry with exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retryCount) * 1000)
          );
        }
      }
    }
  }

  // Phase 3: Pull server changes
  const newTimestamp = await pullChanges(lastSyncTimestamp, onProgress);

  return newTimestamp;
}

export async function getSyncStatus(): Promise<{
  pendingChanges: number;
  queuedChanges: number;
}> {
  const pendingCount = await getPendingCount();
  return {
    pendingChanges: pendingCount,
    queuedChanges: pendingCount,
  };
}
