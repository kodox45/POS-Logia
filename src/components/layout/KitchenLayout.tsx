// Layout: KitchenLayout — Interface: kitchen-display
// Type: fullscreen | Target roles: chef

import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ListOrdered, BookOpen, Home, User } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { clsx } from 'clsx';
import { SyncStatusIndicator } from '@/sync/SyncStatusIndicator';

const NAV_ITEMS = [
  { label: 'Antrian', icon: ListOrdered, path: '/kitchen/queue', screenRef: 'S-006' },
  { label: 'Resep', icon: BookOpen, path: '/kitchen/recipe', screenRef: 'S-007' },
] as const;

export function KitchenLayout() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Compact Header — 48px */}
      <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
        <nav className="flex items-center gap-2 sm:gap-4" aria-label="Navigasi dapur">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1 rounded transition-colors text-sm',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon size={16} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <SyncStatusIndicator />
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <User size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{currentUser?.displayName}</span>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-text-secondary hover:text-primary p-1"
            aria-label="Kembali ke Dashboard Hub"
          >
            <Home size={16} />
          </button>
        </div>
      </header>

      {/* Content — compact padding for kitchen display */}
      <main className="flex-1 overflow-auto p-2 sm:p-3">
        <Outlet />
      </main>
    </div>
  );
}
