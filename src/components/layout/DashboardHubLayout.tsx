// Layout: DashboardHubLayout — Interface: dashboard-hub
// Type: fullscreen-grid | Target roles: all

import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useShiftManagementStore } from '@/stores/useShiftManagementStore';
import { SyncStatusIndicator } from '@/sync/SyncStatusIndicator';

export function DashboardHubLayout() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const logout = useAuthStore((state) => state.logout);
  const activeShift = useShiftManagementStore((state) => state.activeShift);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header — 64px */}
      <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-4 sm:px-6 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-primary" aria-label="Logia POS">Logia POS</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Shift status bar */}
          {activeShift && activeShift.shiftStatus === 'open' ? (
            <div className="flex items-center gap-2 bg-success/10 text-success px-3 py-1 rounded-full text-xs sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
              <span className="hidden sm:inline">Shift Aktif</span>
              <span className="sm:hidden">Aktif</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-warning/10 text-warning px-3 py-1 rounded-full text-xs sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
              <span className="hidden sm:inline">Tidak Ada Shift</span>
              <span className="sm:hidden">No Shift</span>
            </div>
          )}

          {/* Sync status */}
          <SyncStatusIndicator />

          {/* User profile */}
          <div className="flex items-center gap-2 text-text-secondary">
            <User size={18} aria-hidden="true" />
            <span className="text-sm hidden sm:inline">{currentUser?.displayName}</span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-text-secondary hover:text-error transition-colors p-1"
            aria-label="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center p-4 sm:p-6">
        <div className="w-full max-w-[800px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
