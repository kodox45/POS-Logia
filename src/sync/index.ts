// ============================================================
// Sync module — Public API
// ============================================================

export { syncEngine } from './sync-engine';
export { trackChange, getPendingCount, markRecordSynced, markRecordPending } from './change-tracker';
export { resolveConflict, resolveConflicts } from './conflict-resolver';
export { executePushPull, getSyncStatus } from './sync-queue';
export { useSyncStore } from './useSyncStore';
export { notifySync, trackAndSync } from './sync-trigger';
export { SyncStatusIndicator } from './SyncStatusIndicator';
export type {
  SyncableEntity,
  TableName,
  ChangeRecord,
  SyncBatch,
  SyncProgress,
  SyncEngineStatus,
  ConflictRecord,
  ConflictResolution,
  ConflictResolutionStrategy,
  SyncPullResponse,
  SyncPushResponse,
  ServerChange,
} from './types';
export {
  APPEND_ONLY_TABLES,
  ALL_SYNCABLE_TABLES,
  SYNC_BATCH_SIZE,
  SYNC_RETRY_MAX,
  SYNC_INTERVAL_MS,
  SYNC_DEBOUNCE_MS,
} from './types';
