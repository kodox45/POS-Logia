// ============================================================
// Sync Store — Zustand store for sync state management
// Bridges the sync engine singleton to React components
// ============================================================

import { create } from 'zustand';
import { syncEngine } from './sync-engine';
import type { SyncProgress, SyncEngineStatus } from './types';

export interface SyncStoreState {
  // State (mirrors SyncProgress)
  status: SyncEngineStatus;
  lastSyncedAt: string | null;
  pendingChanges: number;
  currentBatch: number;
  totalBatches: number;
  error: string | null;

  // Actions
  startEngine: () => void;
  stopEngine: () => void;
  syncNow: () => Promise<void>;
  requestSync: () => void;
}

export const useSyncStore = create<SyncStoreState>()((set) => {
  // Subscribe to sync engine progress updates
  syncEngine.subscribe((progress: SyncProgress) => {
    set({
      status: progress.status,
      lastSyncedAt: progress.lastSyncedAt,
      pendingChanges: progress.pendingChanges,
      currentBatch: progress.currentBatch,
      totalBatches: progress.totalBatches,
      error: progress.error,
    });
  });

  return {
    status: 'idle',
    lastSyncedAt: null,
    pendingChanges: 0,
    currentBatch: 0,
    totalBatches: 0,
    error: null,

    startEngine: () => {
      syncEngine.start();
    },

    stopEngine: () => {
      syncEngine.stop();
    },

    syncNow: async () => {
      await syncEngine.syncNow();
    },

    requestSync: () => {
      syncEngine.requestSync();
    },
  };
});
