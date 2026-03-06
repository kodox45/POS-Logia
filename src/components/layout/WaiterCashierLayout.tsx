// Layout: WaiterCashierLayout — Interface: waiter-cashier-ui
// Type: bottom-tabs | Target roles: waiter-cashier

import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ClipboardList, LayoutGrid, CreditCard, Home, User, Bell } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useShiftManagementStore } from '@/stores/useShiftManagementStore';
import { clsx } from 'clsx';
import { SyncStatusIndicator } from '@/sync/SyncStatusIndicator';

const NAV_ITEMS = [
  { label: 'Pesanan', icon: ClipboardList, path: '/pos/orders', screenRef: 'S-002' },
  { label: 'Meja', icon: LayoutGrid, path: '/pos/tables', screenRef: 'S-005' },
  { label: 'Bayar', icon: CreditCard, path: '/pos/payment', screenRef: 'S-004' },
] as const;

export function WaiterCashierLayout() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const activeShift = useShiftManagementStore((state) => state.activeShift);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header — 56px */}
      <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          {/* Shift status bar */}
          {activeShift && activeShift.shiftStatus === 'open' ? (
            <div className="flex items-center gap-2 bg-success/10 text-success px-3 py-1 rounded-full text-xs">
              <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
              Shift Aktif
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-warning/10 text-warning px-3 py-1 rounded-full text-xs">
              <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
              No Shift
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <SyncStatusIndicator />
          <button
            className="text-text-secondary hover:text-text-primary relative p-1"
            aria-label="Notifikasi"
          >
            <Bell size={18} />
          </button>
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <User size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{currentUser?.displayName}</span>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-text-secondary hover:text-primary p-1"
            aria-label="Kembali ke Dashboard Hub"
          >
            <Home size={18} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4 pb-20">
        <Outlet />
      </main>

      {/* Bottom Tabs */}
      <nav
        className="fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border flex items-center justify-around shrink-0 z-30"
        aria-label="Navigasi utama"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={clsx(
                'flex flex-col items-center gap-1 px-4 py-2 transition-colors min-w-0',
                isActive ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
            >
              <item.icon size={20} aria-hidden="true" />
              <span className="text-xs truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
