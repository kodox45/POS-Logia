// ============================================================
// SyncStatusIndicator — Online/offline indicator for layouts
// Shows sync status, pending changes count, and last synced time
// ============================================================

import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { useSyncStore } from './useSyncStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function SyncStatusIndicator() {
  const { status, pendingChanges, lastSyncedAt, error } = useSyncStore();
  const { isOnline } = useOnlineStatus();

  const effectiveStatus = !isOnline ? 'offline' : status;

  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite">
      {effectiveStatus === 'offline' && (
        <div className="flex items-center gap-1.5 bg-warning/10 text-warning px-2 py-1 rounded-full text-xs">
          <WifiOff size={14} aria-hidden="true" />
          <span>Offline</span>
          {pendingChanges > 0 && (
            <span className="bg-warning/20 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
              {pendingChanges}
            </span>
          )}
        </div>
      )}

      {effectiveStatus === 'syncing' && (
        <div className="flex items-center gap-1.5 bg-info/10 text-info px-2 py-1 rounded-full text-xs">
          <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
          <span>Sinkronisasi...</span>
        </div>
      )}

      {effectiveStatus === 'error' && (
        <div
          className="flex items-center gap-1.5 bg-error/10 text-error px-2 py-1 rounded-full text-xs"
          title={error ?? 'Sync error'}
        >
          <AlertCircle size={14} aria-hidden="true" />
          <span>Gagal Sinkron</span>
        </div>
      )}

      {effectiveStatus === 'idle' && (
        <div className="flex items-center gap-1.5 bg-success/10 text-success px-2 py-1 rounded-full text-xs">
          <Wifi size={14} aria-hidden="true" />
          <span className="hidden sm:inline">Online</span>
          {pendingChanges > 0 && (
            <span className="bg-success/20 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
              {pendingChanges}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
