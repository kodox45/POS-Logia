// ============================================================
// Sync Trigger — Call after store mutations to queue sync
// Lightweight wrapper that marks records and triggers debounced sync
// ============================================================

import { syncEngine } from './sync-engine';
import { trackChange } from './change-tracker';
import type { TableName, SyncableEntity } from './types';

export function notifySync(): void {
  syncEngine.requestSync();
}

export async function trackAndSync(
  tableName: TableName,
  operation: 'create' | 'update' | 'delete',
  data: SyncableEntity
): Promise<void> {
  await trackChange(tableName, operation, data);
  syncEngine.requestSync();
}
