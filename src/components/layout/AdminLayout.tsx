// Layout: AdminLayout — Interface: admin-panel
// Type: sidebar | Target roles: owner (cross-role access enabled)

import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart2,
  UtensilsCrossed,
  BookOpen,
  Package,
  Receipt,
  Users,
  Settings,
  Home,
  User,
  Bell,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { clsx } from 'clsx';
import { SyncStatusIndicator } from '@/sync/SyncStatusIndicator';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: BarChart2, path: '/admin/dashboard', screenRef: 'S-008' },
  { label: 'Menu', icon: UtensilsCrossed, path: '/admin/menu', screenRef: 'S-009' },
  { label: 'Resep', icon: BookOpen, path: '/admin/recipes', screenRef: 'S-010' },
  { label: 'Stok', icon: Package, path: '/admin/inventory', screenRef: 'S-011' },
  { label: 'Transaksi', icon: Receipt, path: '/admin/transactions', screenRef: 'S-012' },
  { label: 'Pengguna', icon: Users, path: '/admin/users', screenRef: 'S-013' },
  { label: 'Pengaturan', icon: Settings, path: '/admin/settings', screenRef: 'S-017' },
] as const;

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const currentUser = useAuthStore((state) => state.currentUser);
  const navigate = useNavigate();
  const location = useLocation();

  const isNonOwner = currentUser && currentUser.role !== 'owner';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Cross-role quick access bar (C-023) — shown for non-owner users accessing admin screens */}
      {isNonOwner && (
        <div className="h-10 bg-primary/5 border-b border-primary/20 flex items-center justify-between px-4 shrink-0">
          <span className="text-xs text-primary font-medium">
            Akses terbatas: {currentUser.displayName} ({currentUser.role === 'waiter-cashier' ? 'Kasir' : 'Chef'})
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs text-primary hover:text-primary-dark font-medium px-2 py-1 rounded hover:bg-primary/10 transition-colors"
            >
              Dashboard Hub
            </button>
            {currentUser.role === 'waiter-cashier' && (
              <button
                onClick={() => navigate('/pos/orders')}
                className="text-xs text-primary hover:text-primary-dark font-medium px-2 py-1 rounded hover:bg-primary/10 transition-colors"
              >
                POS
              </button>
            )}
            {currentUser.role === 'chef' && (
              <button
                onClick={() => navigate('/kitchen/queue')}
                className="text-xs text-primary hover:text-primary-dark font-medium px-2 py-1 rounded hover:bg-primary/10 transition-colors"
              >
                Dapur
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Sidebar — 250px */}
        <aside
          className={clsx(
            'bg-surface border-r border-border flex flex-col shrink-0 transition-all duration-300',
            sidebarOpen ? 'w-[250px]' : 'w-0 overflow-hidden',
            'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40'
          )}
          aria-label="Sidebar navigasi admin"
        >
          {/* Sidebar Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
            <span className="text-lg font-semibold text-primary">Logia POS</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-text-secondary hover:text-text-primary md:hidden p-1"
              aria-label="Tutup sidebar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 py-4 overflow-y-auto" aria-label="Menu admin">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary border-r-2 border-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Home Button */}
          <div className="border-t border-border p-4 shrink-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center gap-3 px-4 py-2 text-text-secondary hover:text-primary transition-colors text-sm"
              aria-label="Kembali ke Dashboard Hub"
            >
              <Home size={18} aria-hidden="true" />
              <span>Dashboard Hub</span>
            </button>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header — 64px */}
          <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-4 sm:px-6 shrink-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-text-secondary hover:text-text-primary p-1"
              aria-label={sidebarOpen ? 'Tutup sidebar' : 'Buka sidebar'}
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-3 sm:gap-4">
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
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <div className="max-w-[1200px] mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
