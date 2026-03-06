// ============================================================
// Sync Engine — Orchestrates sync lifecycle
// Manages intervals, online/offline transitions, progress state
// ============================================================

import type { SyncProgress } from './types';
import { SYNC_INTERVAL_MS, SYNC_DEBOUNCE_MS } from './types';
import { executePushPull, getSyncStatus } from './sync-queue';
import { getPendingCount } from './change-tracker';

type ProgressListener = (progress: SyncProgress) => void;

class SyncEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private debounceId: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;
  private lastSyncedAt: string | null = null;
  private listeners: Set<ProgressListener> = new Set();
  private currentProgress: SyncProgress = {
    status: 'idle',
    lastSyncedAt: null,
    pendingChanges: 0,
    currentBatch: 0,
    totalBatches: 0,
    error: null,
  };

  subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    listener(this.currentProgress);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(update: Partial<SyncProgress>): void {
    this.currentProgress = { ...this.currentProgress, ...update };
    for (const listener of this.listeners) {
      listener(this.currentProgress);
    }
  }

  getProgress(): SyncProgress {
    return { ...this.currentProgress };
  }

  async syncNow(): Promise<void> {
    if (this.isRunning) return;
    if (!navigator.onLine) {
      this.notify({ status: 'offline', error: null });
      return;
    }

    this.isRunning = true;
    const pendingChanges = await getPendingCount();
    this.notify({
      status: 'syncing',
      pendingChanges,
      error: null,
      currentBatch: 0,
      totalBatches: 0,
    });

    try {
      const newTimestamp = await executePushPull(
        this.lastSyncedAt,
        (partialProgress) => this.notify(partialProgress)
      );

      this.lastSyncedAt = newTimestamp;
      const remainingChanges = await getPendingCount();

      this.notify({
        status: 'idle',
        lastSyncedAt: newTimestamp,
        pendingChanges: remainingChanges,
        currentBatch: 0,
        totalBatches: 0,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      this.notify({
        status: 'error',
        error: message,
      });
    } finally {
      this.isRunning = false;
    }
  }

  requestSync(): void {
    if (this.debounceId) {
      clearTimeout(this.debounceId);
    }

    this.debounceId = setTimeout(() => {
      this.debounceId = null;
      this.syncNow();
    }, SYNC_DEBOUNCE_MS);
  }

  start(): void {
    if (this.intervalId) return;

    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Set initial status based on connectivity
    if (!navigator.onLine) {
      this.notify({ status: 'offline' });
    } else {
      // Initial sync
      this.syncNow();
    }

    // Periodic sync
    this.intervalId = setInterval(() => {
      if (navigator.onLine) {
        this.syncNow();
      }
    }, SYNC_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.debounceId) {
      clearTimeout(this.debounceId);
      this.debounceId = null;
    }

    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);

    this.notify({ status: 'idle' });
  }

  private handleOnline = (): void => {
    this.notify({ status: 'idle', error: null });
    // Trigger sync when coming back online
    this.syncNow();
  };

  private handleOffline = (): void => {
    this.notify({ status: 'offline', error: null });
  };

  getLastSyncedAt(): string | null {
    return this.lastSyncedAt;
  }

  isActive(): boolean {
    return this.intervalId !== null;
  }
}

// Singleton instance
export const syncEngine = new SyncEngine();
